import React, { useCallback, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  ButtonSet,
  Checkbox,
  Form,
  FormLabel,
  InlineLoading,
  InlineNotification,
  Select,
  SelectItem,
  Stack,
  Tag,
  TextArea,
  TextInput,
} from '@carbon/react';
import { ArrowLeft, Renew } from '@carbon/react/icons';
import { showSnackbar, useSession, Workspace2 } from '@openmrs/esm-framework';
import type { Workspace2DefinitionProps } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import OTPInput from '../../../shared/ui/otp-input/otp-input.component';
import { createConsentRequest, extractShrErrorDetail, verifyConsentOtp } from '../../shr.resource';
import {
  SHR_REPRESENTATIVE_RELATIONSHIPS,
  type CreateConsentRequest,
  type CreateConsentResponse,
  type ShrConsentDeclined,
  type ShrConsentGrant,
  type ShrRepresentativeRelationship,
  type ShrVisitType,
} from '../../shr.types';
import { createValidationSchema, type ShrConsentFormSchema } from './schema';
import styles from './shr-consent.scss';

/** Registration name, shared with whoever launches this workspace. */
export const SHR_CONSENT_WORKSPACE = 'shr-consent-workspace';

/** The OTP the SHR dispatches is five digits (see the verify contract). */
const OTP_LENGTH = 5;

type Step = 'request' | 'otp' | 'reject';

interface ShrConsentWorkspaceProps {
  /** The patient's Client Registry number, resolved by the caller from their identifiers. */
  crId?: string;
  locationUuid?: string;
  /**
   * Whether the patient is under 18, computed by the caller from the patient it
   * already has loaded (see `isMinorPatient`). A minor cannot consent for
   * themselves, so the representative fields become required and are not
   * offered as a choice.
   */
  isMinor?: boolean;
  /**
   * Fired after a successful verify, with the token and visit id the caller needs
   * to fetch records and later close the visit.
   */
  onConsentGranted?: (grant: ShrConsentGrant) => void;
  /**
   * Fired when the patient *refused*. No token, no visit — a settled outcome
   * the caller shows its own terminal state for, not an error.
   */
  onConsentDeclined?: (declined: ShrConsentDeclined) => void;
}

/** Props shared by every workspace in the chart's `patient-chart` group. */
interface PatientChartGroupProps {
  patientUuid?: string;
}

/**
 * SHR visit consent. Nominally two steps:
 *
 *   request (visit type / who consents / emergency)
 *     → POST /shr/consents                — dispatches an OTP
 *   otp     (enter the code the patient received)
 *     → POST /shr/consents/{id}/verify    — returns the consent token + visit id
 *     → closeWorkspace() + onConsentGranted({ consentToken, visitId })
 *
 * Two documented paths leave that spine, and both are driven by what the
 * *response* says rather than by what was asked for:
 *
 *  - **emergency** — approved on the spot, so `POST /shr/consents` itself comes
 *    back with the token and visit id and no `otp_record`. There is no second
 *    step; advancing to one would strand the user on a code nobody was sent.
 *  - **refusal** — the patient declines. `verify` is still the endpoint, but
 *    with `consent_decision: 'Reject'` and a reason instead of a password, and
 *    it settles with no token and no visit opened.
 *
 * Who may consent is a separate axis from all of that — see `schema.ts`.
 *
 * The workspace's whole job is getting from "no consent" to a settled outcome —
 * fetching and rendering the records belongs to the parent.
 */
const ShrConsentWorkspace: React.FC<
  Workspace2DefinitionProps<ShrConsentWorkspaceProps, object, PatientChartGroupProps>
> = ({ closeWorkspace, workspaceProps }) => {
  const { t } = useTranslation();
  const session = useSession();
  const [step, setStep] = useState<Step>('request');
  const [consent, setConsent] = useState<CreateConsentResponse | null>(null);
  const [otp, setOtp] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [requestError, setRequestError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const crId = workspaceProps?.crId ?? '';
  const locationUuid = workspaceProps?.locationUuid ?? '';
  const isMinor = workspaceProps?.isMinor ?? false;
  const onConsentGranted = workspaceProps?.onConsentGranted;
  const onConsentDeclined = workspaceProps?.onConsentDeclined;

  const requestedBy =
    session?.user?.person?.display?.trim() || session?.user?.display?.trim() || t('clinician', 'Clinician');

  // Which fields are required depends on the patient's age, so the schema is
  // built per patient rather than branching inside every field.
  const validationSchema = useMemo(() => createValidationSchema(isMinor), [isMinor]);

  const {
    control,
    handleSubmit,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ShrConsentFormSchema>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      visitType: 'IP',
      emergency: false,
      patientUnableToConsent: false,
      incapacityReason: '',
      representativeCrId: '',
    },
  });

  const isEmergency = watch('emergency');
  const patientUnableToConsent = watch('patientUnableToConsent');
  const needsRelationship = isEmergency || isMinor || patientUnableToConsent;
  const needsRepresentativeCrId = !isEmergency && (isMinor || patientUnableToConsent);
  const needsIncapacityReason = isEmergency || (!isMinor && patientUnableToConsent);

  /** POST /shr/consents. Shared by the initial submit and "Resend OTP". */
  const sendConsentRequest = useCallback(
    async (values: ShrConsentFormSchema, { isResend }: { isResend: boolean }) => {
      setSending(true);
      setRequestError('');
      setOtpError('');
      try {
        const emergency = values.emergency;
        const relationshipNeeded = emergency || isMinor || values.patientUnableToConsent;
        const representativeCrIdNeeded = !emergency && (isMinor || values.patientUnableToConsent);
        const reasonNeeded = emergency || (!isMinor && values.patientUnableToConsent);

        const payload: CreateConsentRequest = {
          crId,
          locationUuid,
          requestedBy,
          visitType: values.visitType as ShrVisitType,
          emergency: emergency ? 1 : 0,
          ...(representativeCrIdNeeded ? { patientCapable: 0 as const } : {}),
          ...(reasonNeeded && values.incapacityReason?.trim()
            ? { incapacityReason: values.incapacityReason.trim() }
            : {}),
          // Gated on the field being *shown*, not on it being required: the CR
          // number is optional in an emergency but still forwarded when given.
          ...(relationshipNeeded && values.representativeCrId?.trim()
            ? { representativeCrId: values.representativeCrId.trim() }
            : {}),
          ...(relationshipNeeded && values.representativeRelationship
            ? {
                representativeRelationship: values.representativeRelationship as ShrRepresentativeRelationship,
              }
            : {}),
        };

        const response = await createConsentRequest(payload);

        if (!response?.consent_id) {
          throw new Error(t('shrConsentNoId', 'The SHR service did not return a consent request to verify.'));
        }

        // Branch on the response, not on the emergency flag: the flag is what we
        // asked for, this is what DHA actually did. An emergency consent is
        // already approved, so there is nothing to verify.
        if (response.consent_token && response.visit_id) {
          showSnackbar({
            kind: 'success',
            title: t('shrEmergencyConsentApproved', 'Emergency consent approved'),
            subtitle: t('shrConsentApprovedDetail', "Fetching the patient's shared health record."),
          });
          await closeWorkspace({ discardUnsavedChanges: true });
          onConsentGranted?.({ consentToken: response.consent_token, visitId: response.visit_id });
          return;
        }

        if (!response.otp_record) {
          throw new Error(t('shrConsentNoOtpRecord', 'The SHR service did not send an OTP for this consent request.'));
        }

        setConsent(response);
        setOtp('');
        setStep('otp');
        showSnackbar({
          kind: 'success',
          title: isResend ? t('shrOtpResent', 'OTP resent') : t('shrOtpSent', 'OTP sent'),
          subtitle: representativeCrIdNeeded
            ? t('shrOtpSentRepresentativeDetail', "A code was sent to the representative's registered contact.")
            : t('shrOtpSentDetail', "A code was sent to the patient's registered contact."),
        });
      } catch (err: any) {
        const detail = extractShrErrorDetail(err?.message ?? '');
        if (isResend) {
          // Stay on the OTP step — the previous code may still be valid.
          setOtpError(detail);
        } else {
          setRequestError(detail);
        }
      } finally {
        setSending(false);
      }
    },
    [closeWorkspace, crId, isMinor, locationUuid, onConsentGranted, requestedBy, t],
  );

  const onSubmit = (values: ShrConsentFormSchema) => sendConsentRequest(values, { isResend: false });

  const handleResend = () => sendConsentRequest(getValues(), { isResend: true });

  const handleVerify = async () => {
    if (!consent?.consent_id || !consent.otp_record) {
      return;
    }
    setVerifying(true);
    setOtpError('');
    try {
      const response = await verifyConsentOtp(consent.consent_id, {
        otp,
        locationUuid,
        otpRecord: consent.otp_record,
        // Not forwarded to DHA — it keys the consent session the backend
        // records, which is what GET /shr/consents/active reads back.
        crId,
      });

      // A 200 is not automatically a token: this endpoint also settles refusals
      // and completes closures. Branch on what actually came back.
      if (response?.consent_token && response?.visit_id) {
        showSnackbar({
          kind: 'success',
          title: t('shrConsentApproved', 'Consent approved'),
          subtitle: t('shrConsentApprovedDetail', "Fetching the patient's shared health record."),
        });
        // The consent is granted, so the in-flight OTP is no longer unsaved work.
        await closeWorkspace({ discardUnsavedChanges: true });
        onConsentGranted?.({ consentToken: response.consent_token, visitId: response.visit_id });
        return;
      }

      // `end_date` is unambiguous and so is checked before the status string:
      // it means this verified a *closure*, not a consent. The consent workspace
      // has no closure in flight, so say so rather than reporting a success with
      // no token behind it.
      if (response?.end_date) {
        throw new Error(t('shrConsentClosedNotGranted', 'That code closed a visit rather than granting consent.'));
      }

      // A refusal recorded through some other channel while this step was open —
      // settled, not an error, so hand it to the same terminal state.
      if (response?.consent_status && response.consent_status.toLowerCase() !== 'approved') {
        await closeWorkspace({ discardUnsavedChanges: true });
        onConsentDeclined?.({
          consentId: response.consent_id ?? consent.consent_id,
          consentStatus: response.consent_status,
        });
        return;
      }

      throw new Error(
        t('shrConsentIncomplete', 'Consent was accepted but the SHR service did not return an access token.'),
      );
    } catch (err: any) {
      setOtpError(extractShrErrorDetail(err?.message ?? ''));
    } finally {
      setVerifying(false);
    }
  };

  /**
   * Record a refusal. Same verify endpoint, but with the decision and a reason
   * instead of a password — a patient who declines never gives one, so no `otp`
   * goes up. Nothing is granted and no visit opens.
   */
  const handleReject = async () => {
    if (!consent?.consent_id || !consent.otp_record || !rejectionReason.trim()) {
      return;
    }
    setVerifying(true);
    setOtpError('');
    try {
      const response = await verifyConsentOtp(consent.consent_id, {
        locationUuid,
        otpRecord: consent.otp_record,
        consentDecision: 'Reject',
        rejectionReason: rejectionReason.trim(),
        crId,
      });

      await closeWorkspace({ discardUnsavedChanges: true });
      onConsentDeclined?.({
        consentId: response?.consent_id ?? consent.consent_id,
        consentStatus: response?.consent_status ?? 'Rejected',
        rejectionReason: rejectionReason.trim(),
      });
    } catch (err: any) {
      setOtpError(extractShrErrorDetail(err?.message ?? ''));
    } finally {
      setVerifying(false);
    }
  };

  const busy = sending || verifying || isSubmitting;
  const canRequest = Boolean(crId && locationUuid);

  return (
    <Workspace2
      title={t('shrVisitConsent', 'SHR visit consent')}
      // Once an OTP is out with the patient, closing loses that in-flight
      // request — and the same is true of a refusal being written down.
      hasUnsavedChanges={step !== 'request'}
    >
      <Form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <div className={styles.formContainer}>
          {!canRequest ? (
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              title={t('shrConsentMissingContext', 'Missing patient or facility')}
              subtitle={t(
                'shrConsentMissingContextDetail',
                'Open this workspace from the patient chart SHR page, with a login location selected.',
              )}
            />
          ) : (
            <>
              <p className={styles.crId}>{crId}</p>

              {step === 'request' && (
                <Stack gap={5}>
                  {requestError && (
                    <InlineNotification
                      kind="error"
                      lowContrast
                      hideCloseButton
                      title={t('shrConsentRequestFailed', "Couldn't create the consent request.")}
                      subtitle={requestError}
                    />
                  )}

                  <Controller
                    name="visitType"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        id="shr-visit-type"
                        labelText={t('visitType', 'Visit type')}
                        invalid={!!errors.visitType}
                        invalidText={errors.visitType?.message}
                      >
                        <SelectItem value="IP" text={t('shrVisitTypeInpatient', 'IP – inpatient')} />
                        <SelectItem value="OP" text={t('shrVisitTypeOutpatient', 'OP – outpatient')} />
                      </Select>
                    )}
                  />

                  <TextInput
                    id="shr-requested-by"
                    labelText={t('requestedBy', 'Requested by')}
                    value={requestedBy}
                    readOnly
                    disabled
                  />

                  <Controller
                    name="emergency"
                    control={control}
                    render={({ field: { value, onChange, ...rest } }) => (
                      <Checkbox
                        {...rest}
                        id="shr-emergency"
                        labelText={t('emergencyVisit', 'Emergency visit')}
                        helperText={t(
                          'shrEmergencyHelper',
                          'Approved immediately — no OTP is sent to anyone. Still records who authorised the access. Use only when consent cannot be collected at the point of care.',
                        )}
                        checked={!!value}
                        onChange={(_event, { checked }) => onChange(checked)}
                      />
                    )}
                  />

                  {/* A minor's representative is required by their age, so there is
                      no toggle to offer. An adult's incapacity is a clinical
                      judgement, so there is. */}
                  {isMinor ? (
                    <InlineNotification
                      kind="info"
                      lowContrast
                      hideCloseButton
                      title={t('shrPatientIsMinor', 'Patient is a minor')}
                      subtitle={t(
                        'shrPatientIsMinorDetail',
                        'Consent is given by a parent or guardian, and the OTP goes to them.',
                      )}
                    />
                  ) : (
                    !isEmergency && (
                      <Controller
                        name="patientUnableToConsent"
                        control={control}
                        render={({ field: { value, onChange, ...rest } }) => (
                          <Checkbox
                            {...rest}
                            id="shr-patient-unable"
                            labelText={t('shrPatientUnableToConsent', 'Patient unable to consent')}
                            helperText={t(
                              'shrPatientUnableToConsentHelper',
                              'An incapacitated adult. Consent is given by a representative, who receives the OTP.',
                            )}
                            checked={!!value}
                            onChange={(_event, { checked }) => onChange(checked)}
                          />
                        )}
                      />
                    )
                  )}

                  {needsIncapacityReason && (
                    <Controller
                      name="incapacityReason"
                      control={control}
                      render={({ field }) => (
                        <TextInput
                          {...field}
                          id="shr-incapacity-reason"
                          labelText={t('incapacityReason', 'Incapacity reason')}
                          placeholder={t('incapacityReasonPlaceholder', 'Reason patient cannot consent directly')}
                          invalid={!!errors.incapacityReason}
                          invalidText={errors.incapacityReason?.message}
                        />
                      )}
                    />
                  )}

                  {needsRelationship && (
                    <>
                      <Controller
                        name="representativeRelationship"
                        control={control}
                        render={({ field: { value, ...rest } }) => (
                          <Select
                            {...rest}
                            value={value ?? ''}
                            id="shr-representative-relationship"
                            labelText={
                              isEmergency
                                ? t('shrAuthorisingRelationship', 'Relationship of the authorising person')
                                : t('shrRepresentativeRelationship', 'Relationship to patient')
                            }
                            invalid={!!errors.representativeRelationship}
                            invalidText={errors.representativeRelationship?.message}
                          >
                            <SelectItem value="" text={t('selectAnOption', 'Select an option')} />
                            {/* Exactly the values DHA accepts — anything else is
                                rejected upstream, so this list is not extensible here. */}
                            {SHR_REPRESENTATIVE_RELATIONSHIPS.map((relationship) => (
                              <SelectItem key={relationship} value={relationship} text={relationship} />
                            ))}
                          </Select>
                        )}
                      />

                      <Controller
                        name="representativeCrId"
                        control={control}
                        render={({ field }) => (
                          <TextInput
                            {...field}
                            id="shr-representative-cr-id"
                            labelText={
                              needsRepresentativeCrId
                                ? t('shrRepresentativeCrId', 'Representative CR number')
                                : t('shrRepresentativeCrIdOptional', 'Representative CR number (optional)')
                            }
                            placeholder={t(
                              'shrRepresentativeCrIdPlaceholder',
                              'Client Registry number of the parent, guardian or proxy',
                            )}
                            helperText={
                              needsRepresentativeCrId
                                ? undefined
                                : t(
                                    'shrRepresentativeCrIdEmergencyHelper',
                                    'Leave blank if the patient arrived unaccompanied or unidentified.',
                                  )
                            }
                            invalid={!!errors.representativeCrId}
                            invalidText={errors.representativeCrId?.message}
                          />
                        )}
                      />
                    </>
                  )}
                </Stack>
              )}

              {step === 'otp' && (
                <Stack gap={5}>
                  <Button
                    kind="ghost"
                    size="sm"
                    className={styles.ghostLink}
                    renderIcon={ArrowLeft}
                    onClick={() => setStep('request')}
                    disabled={busy}
                  >
                    {t('editRequest', 'Edit request')}
                  </Button>

                  <div className={styles.statusRow}>
                    <Tag size="sm" type="teal">
                      {consent?.consent_status || t('pending', 'Pending')}
                    </Tag>
                    <span className={styles.consentId}>{consent?.consent_id}</span>
                  </div>

                  <p className={styles.helperText}>
                    {t(
                      'shrOtpInstructions',
                      "An OTP has been sent to the patient's registered contact. Enter the code below to verify consent.",
                    )}
                  </p>

                  {otpError && (
                    <InlineNotification
                      kind="error"
                      lowContrast
                      hideCloseButton
                      title={t('shrOtpFailed', "That code didn't verify.")}
                      subtitle={otpError}
                    />
                  )}

                  <div className={styles.otpField}>
                    <FormLabel>{t('otpCode', 'OTP code')}</FormLabel>
                    <OTPInput otpLength={OTP_LENGTH} onChange={setOtp} disabled={busy} />
                  </div>

                  <Button
                    kind="ghost"
                    size="sm"
                    className={styles.ghostLink}
                    renderIcon={Renew}
                    onClick={handleResend}
                    disabled={busy}
                  >
                    {t('resendOtp', 'Resend OTP')}
                  </Button>

                  {/* A consent that cannot be refused is not consent. */}
                  <Button
                    kind="ghost"
                    size="sm"
                    className={styles.ghostLink}
                    onClick={() => {
                      setOtpError('');
                      setStep('reject');
                    }}
                    disabled={busy}
                  >
                    {t('shrPatientDeclined', 'Patient declined to consent')}
                  </Button>
                </Stack>
              )}

              {step === 'reject' && (
                <Stack gap={5}>
                  <Button
                    kind="ghost"
                    size="sm"
                    className={styles.ghostLink}
                    renderIcon={ArrowLeft}
                    onClick={() => setStep('otp')}
                    disabled={busy}
                  >
                    {t('shrBackToOtp', 'Back to OTP')}
                  </Button>

                  <div className={styles.statusRow}>
                    <Tag size="sm" type="red">
                      {t('shrDeclining', 'Declining')}
                    </Tag>
                    <span className={styles.consentId}>{consent?.consent_id}</span>
                  </div>

                  <p className={styles.helperText}>
                    {t(
                      'shrRejectInstructions',
                      'Recording a refusal closes this request without opening a visit. No records will be fetched.',
                    )}
                  </p>

                  {otpError && (
                    <InlineNotification
                      kind="error"
                      lowContrast
                      hideCloseButton
                      title={t('shrRejectFailed', "Couldn't record the refusal.")}
                      subtitle={otpError}
                    />
                  )}

                  <TextArea
                    id="shr-rejection-reason"
                    labelText={t('shrRejectionReason', 'Reason for declining')}
                    placeholder={t('shrRejectionReasonPlaceholder', 'What the patient gave as their reason')}
                    rows={3}
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    disabled={busy}
                  />
                </Stack>
              )}
            </>
          )}
        </div>

        <ButtonSet className={styles.buttonSet}>
          <Button kind="secondary" onClick={() => void closeWorkspace()} disabled={busy}>
            {t('cancel', 'Cancel')}
          </Button>
          {step === 'request' && (
            <Button kind="primary" type="submit" disabled={busy || !canRequest}>
              {sending ? (
                <InlineLoading description={t('sendingOtpRequest', 'Sending OTP request…')} />
              ) : (
                t('sendOtpRequest', 'Send OTP request')
              )}
            </Button>
          )}
          {step === 'otp' && (
            <Button
              kind="primary"
              type="button"
              onClick={handleVerify}
              disabled={busy || otp.trim().length < OTP_LENGTH}
            >
              {verifying ? (
                <InlineLoading description={t('verifying', 'Verifying…')} />
              ) : (
                t('verifyConsent', 'Verify consent')
              )}
            </Button>
          )}
          {step === 'reject' && (
            <Button kind="danger" type="button" onClick={handleReject} disabled={busy || !rejectionReason.trim()}>
              {verifying ? (
                <InlineLoading description={t('recording', 'Recording…')} />
              ) : (
                t('shrConfirmDecline', 'Record refusal')
              )}
            </Button>
          )}
        </ButtonSet>
      </Form>
    </Workspace2>
  );
};

export default ShrConsentWorkspace;
