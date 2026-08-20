import React, { useCallback, useState } from 'react';
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
  TextInput,
} from '@carbon/react';
import { ArrowLeft, Renew } from '@carbon/react/icons';
import { showSnackbar, useSession, Workspace2 } from '@openmrs/esm-framework';
import type { Workspace2DefinitionProps } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import OTPInput from '../../../shared/ui/otp-input/otp-input.component';
import { createConsentRequest, extractShrErrorDetail, verifyConsentOtp } from '../../shr.resource';
import { type CreateConsentResponse, type ShrConsentGrant, type ShrVisitType } from '../../shr.types';
import { validationSchema, type ShrConsentFormSchema } from './schema';
import styles from './shr-consent.scss';

/** Registration name, shared with whoever launches this workspace. */
export const SHR_CONSENT_WORKSPACE = 'shr-consent-workspace';

/** The OTP the SHR dispatches is five digits (see the verify contract). */
const OTP_LENGTH = 5;

type Step = 'request' | 'otp';

interface ShrConsentWorkspaceProps {
  /** The patient's Client Registry number, resolved by the caller from their identifiers. */
  crId?: string;
  locationUuid?: string;
  /**
   * Fired after a successful verify, with the token and visit id the caller needs
   * to fetch records and later close the visit.
   */
  onConsentGranted?: (grant: ShrConsentGrant) => void;
}

/** Props shared by every workspace in the chart's `patient-chart` group. */
interface PatientChartGroupProps {
  patientUuid?: string;
}

/**
 * Two-step SHR visit consent:
 *
 *   request (visit type / emergency / incapacity reason)
 *     → POST /shr/consents                — dispatches an OTP to the patient
 *   otp     (enter the code the patient received)
 *     → POST /shr/consents/{id}/verify    — returns the consent token + visit id
 *     → closeWorkspace() + onConsentGranted({ consentToken, visitId })
 *
 * The workspace's whole job is getting from "no consent" to a granted token —
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
  const [requestError, setRequestError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const crId = workspaceProps?.crId ?? '';
  const locationUuid = workspaceProps?.locationUuid ?? '';
  const onConsentGranted = workspaceProps?.onConsentGranted;

  const requestedBy =
    session?.user?.person?.display?.trim() || session?.user?.display?.trim() || t('clinician', 'Clinician');

  const {
    control,
    handleSubmit,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ShrConsentFormSchema>({
    resolver: zodResolver(validationSchema),
    defaultValues: { visitType: 'IP', emergency: false, incapacityReason: '' },
  });

  const isEmergency = watch('emergency');

  /** POST /shr/consents. Shared by the initial submit and "Resend OTP". */
  const sendConsentRequest = useCallback(
    async (values: ShrConsentFormSchema, { isResend }: { isResend: boolean }) => {
      setSending(true);
      setRequestError('');
      setOtpError('');
      try {
        const response = await createConsentRequest({
          crId,
          locationUuid,
          requestedBy,
          visitType: values.visitType as ShrVisitType,
          emergency: values.emergency ? 1 : 0,
          // Misspelled upstream — kept exactly as the backend expects it.
          ...(values.emergency && values.incapacityReason?.trim()
            ? { incapavity_reason: values.incapacityReason.trim() }
            : {}),
        });

        if (!response?.consent_id) {
          throw new Error(t('shrConsentNoId', 'The SHR service did not return a consent request to verify.'));
        }

        setConsent(response);
        setOtp('');
        setStep('otp');
        showSnackbar({
          kind: 'success',
          title: isResend ? t('shrOtpResent', 'OTP resent') : t('shrOtpSent', 'OTP sent'),
          subtitle: t('shrOtpSentDetail', "A code was sent to the patient's registered contact."),
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
    [crId, locationUuid, requestedBy, t],
  );

  const onSubmit = (values: ShrConsentFormSchema) => sendConsentRequest(values, { isResend: false });

  const handleResend = () => sendConsentRequest(getValues(), { isResend: true });

  const handleVerify = async () => {
    if (!consent?.consent_id) {
      return;
    }
    setVerifying(true);
    setOtpError('');
    try {
      const response = await verifyConsentOtp(consent.consent_id, {
        otp,
        locationUuid,
        otpRecord: consent.otp_record,
      });

      // `visit_id` is the only source of the visit uuid needed to close the visit
      // later, so a response missing either half is not a usable consent.
      if (!response?.consent_token || !response?.visit_id) {
        throw new Error(
          t('shrConsentIncomplete', 'Consent was accepted but the SHR service did not return an access token.'),
        );
      }

      showSnackbar({
        kind: 'success',
        title: t('shrConsentApproved', 'Consent approved'),
        subtitle: t('shrConsentApprovedDetail', "Fetching the patient's shared health record."),
      });

      // The consent is granted, so the in-flight OTP is no longer unsaved work.
      await closeWorkspace({ discardUnsavedChanges: true });
      onConsentGranted?.({ consentToken: response.consent_token, visitId: response.visit_id });
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
      // Once an OTP is out with the patient, closing loses that in-flight request.
      hasUnsavedChanges={step === 'otp'}
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
                        checked={!!value}
                        onChange={(_event, { checked }) => onChange(checked)}
                      />
                    )}
                  />

                  {isEmergency && (
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
                </Stack>
              )}
            </>
          )}
        </div>

        <ButtonSet className={styles.buttonSet}>
          <Button kind="secondary" onClick={() => void closeWorkspace()} disabled={busy}>
            {t('cancel', 'Cancel')}
          </Button>
          {step === 'request' ? (
            <Button kind="primary" type="submit" disabled={busy || !canRequest}>
              {sending ? (
                <InlineLoading description={t('sendingOtpRequest', 'Sending OTP request…')} />
              ) : (
                t('sendOtpRequest', 'Send OTP request')
              )}
            </Button>
          ) : (
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
        </ButtonSet>
      </Form>
    </Workspace2>
  );
};

export default ShrConsentWorkspace;
