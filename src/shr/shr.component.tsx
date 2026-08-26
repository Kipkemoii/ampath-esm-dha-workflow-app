import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, FormLabel, InlineLoading, InlineNotification } from '@carbon/react';
import { CheckmarkFilled, DocumentBlank, ErrorFilled, Security, WarningAltFilled } from '@carbon/react/icons';
import { launchWorkspace2, showSnackbar, useConfig, usePatient, useSession } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import OTPInput from '../shared/ui/otp-input/otp-input.component';
import {
  closeShrVisit,
  extractShrErrorDetail,
  fetchPatientRecords,
  getActiveConsent,
  getPatientCrIdentifier,
  isMinorPatient,
  verifyConsentOtp,
} from './shr.resource';
import type { ShrConsentDeclined, ShrConsentGrant, ShrRecordSet } from './shr.types';
import ShrCloseVisitForm from './shr-close-visit-form.component';
import ShrViewer from './shr-viewer/shr-viewer.component';
import { formatMoment } from './shr-viewer/shr-presentation';
import { SHR_CONSENT_WORKSPACE } from './workspaces/shr-consent-workspace/shr-consent.workspace';
import styles from './shr.scss';

/** The closure OTP is the same five digits as the consent OTP. */
const OTP_LENGTH = 5;

/**
 * Shared Health Record tab for the patient chart.
 *
 * Owns the session state machine around the consent workspace: the workspace's
 * only job is settling a consent request; everything after that — fetching the
 * records, rendering them, and closing the SHR visit — happens here. Nothing is
 * fetched before consent is granted, because the records endpoint requires the
 * consent token.
 *
 *   idle → (open-visit check) ──────────────┐  reuses an existing consent
 *        → (consent workspace) → declined   │
 *                              → fetching ←─┘ → records | empty | error
 *                                              ↓ close visit
 *                            closing-otp (OTP-gated) → closed → idle
 *                                              ↑
 *                            immediate closure ┘
 *
 * Two branches exist because the SHR has two of them: a consent request settles
 * as granted *or refused*, and a closure completes immediately *or* waits on an
 * OTP. Both are decided by which fields the response actually carries.
 */

type Phase = 'idle' | 'checking' | 'fetching' | 'records' | 'empty' | 'error' | 'closing-otp' | 'closed' | 'declined';
type CrStatus = 'loading' | 'ready' | 'missing' | 'error';

interface SharedHealthRecordProps {
  /** Passed by the patient-chart slot; falls back to the chart's patient when absent. */
  patientUuid?: string;
}

const SharedHealthRecord: React.FC<SharedHealthRecordProps> = ({ patientUuid: patientUuidProp }) => {
  const { t } = useTranslation();
  const { patient, isLoading: isPatientLoading } = usePatient();
  const session = useSession();
  const config = useConfig<ConfigObject>();

  const patientUuid = patientUuidProp || patient?.id || '';
  const locationUuid = session?.sessionLocation?.uuid ?? '';
  const crIdentifierTypeUuid = config?.electivePreauth?.clientRegistryIdentifierTypeUuid;

  const resourceTypes = useMemo(
    () => (config?.shrResourceTypes ?? []).filter((entry) => Boolean(entry?.resourceType)),
    [config?.shrResourceTypes],
  );

  const [crId, setCrId] = useState('');
  const [crStatus, setCrStatus] = useState<CrStatus>('loading');
  const [crError, setCrError] = useState('');

  const [phase, setPhase] = useState<Phase>('idle');
  const [grant, setGrant] = useState<ShrConsentGrant | null>(null);
  const [recordSet, setRecordSet] = useState<ShrRecordSet | null>(null);
  const [syncedAt, setSyncedAt] = useState('');
  const [fetchError, setFetchError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [closeError, setCloseError] = useState('');
  const [closedOn, setClosedOn] = useState('');

  // The closure confirmation in front of "Close visit" — see ShrCloseVisitForm
  // for the patient_incapable / patient_capable polarity warning.
  const [isCloseFormOpen, setIsCloseFormOpen] = useState(false);
  const [closePatientIncapable, setClosePatientIncapable] = useState(false);
  const [closeIncapacityReason, setCloseIncapacityReason] = useState('');

  // An OTP-gated closure: the visit is still open until this is verified.
  const [pendingClose, setPendingClose] = useState<{ consentId: string; otpRecord: string } | null>(null);
  const [closeOtp, setCloseOtp] = useState('');

  const [declined, setDeclined] = useState<ShrConsentDeclined | null>(null);

  // Under-18 patients cannot consent for themselves, so the consent request
  // needs a representative. `usePatient()` is FHIR-shaped here, so `birthDate`
  // is what's on hand — `isMinorPatient` takes either shape.
  const isMinor = useMemo(() => isMinorPatient(patient), [patient]);

  // The consent request is keyed on the patient's Client Registry number, so
  // resolve it up front rather than asking the clinician to type it.
  useEffect(() => {
    if (!patientUuid) {
      return;
    }
    let cancelled = false;
    setCrStatus('loading');
    setCrError('');
    getPatientCrIdentifier(patientUuid, crIdentifierTypeUuid)
      .then((identifier) => {
        if (cancelled) {
          return;
        }
        setCrId(identifier);
        setCrStatus(identifier ? 'ready' : 'missing');
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setCrError(extractShrErrorDetail(err?.message ?? ''));
        setCrStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [patientUuid, crIdentifierTypeUuid]);

  const loadRecords = useCallback(
    async (activeGrant: ShrConsentGrant, { isSync }: { isSync: boolean }) => {
      if (isSync) {
        setIsSyncing(true);
        setSyncError('');
      } else {
        setPhase('fetching');
        setFetchError('');
      }
      try {
        const records = await fetchPatientRecords({
          crId,
          resourceTypes: Array.from(new Set(resourceTypes.map((entry) => entry.resourceType))),
          locationUuid,
          consentToken: activeGrant.consentToken,
        });
        setRecordSet(records);
        setSyncedAt(new Date().toISOString());
        setPhase(records.resources.length ? 'records' : 'empty');
      } catch (err: any) {
        const detail = extractShrErrorDetail(err?.message ?? '');
        if (isSync) {
          // A failed refresh must not throw away records that are already on screen.
          setSyncError(detail);
        } else {
          setFetchError(detail);
          setPhase('error');
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [crId, locationUuid, resourceTypes],
  );

  const handleConsentGranted = useCallback(
    (granted: ShrConsentGrant) => {
      setGrant(granted);
      setCloseError('');
      setClosedOn('');
      setSyncError('');
      setDeclined(null);
      void loadRecords(granted, { isSync: false });
    },
    [loadRecords],
  );

  /** A refusal settles the request without opening a visit — its own end state. */
  const handleConsentDeclined = useCallback((refusal: ShrConsentDeclined) => {
    setGrant(null);
    setRecordSet(null);
    setDeclined(refusal);
    setPhase('declined');
  }, []);

  const launchConsentWorkspace = useCallback(async () => {
    if (!crId) {
      return;
    }
    if (!locationUuid) {
      showSnackbar({
        kind: 'error',
        title: t('noLoginLocation', 'No login location selected'),
        subtitle: t('shrNeedsLocation', 'An SHR consent request must be scoped to a facility.'),
      });
      return;
    }
    try {
      await launchWorkspace2(SHR_CONSENT_WORKSPACE, {
        crId,
        locationUuid,
        isMinor,
        onConsentGranted: handleConsentGranted,
        onConsentDeclined: handleConsentDeclined,
      });
    } catch (err: any) {
      console.error(err);
      showSnackbar({
        kind: 'error',
        title: t('shrConsentWorkspaceFailed', "Couldn't open the SHR consent form"),
        subtitle: err?.message ?? '',
      });
    }
  }, [crId, locationUuid, isMinor, handleConsentGranted, handleConsentDeclined, t]);

  /**
   * Start an SHR session. A patient who already has an open visit at this
   * facility cannot start another, and reusing it costs one refresh instead of
   * putting them through a second OTP — so ask the server first.
   *
   * This has to be a server call rather than anything cached locally: a visit
   * opened from a different device or browser is invisible to this one.
   * `hasActiveConsent: false` is the normal "go ahead and request" answer, and a
   * failed check is non-fatal — fall through to the consent request, which is
   * what would have happened anyway.
   */
  const startShrSession = useCallback(async () => {
    if (!crId || !locationUuid) {
      void launchConsentWorkspace();
      return;
    }
    setPhase('checking');
    try {
      const active = await getActiveConsent(crId, locationUuid);
      if (active?.hasActiveConsent && active.consentToken && active.visitId) {
        showSnackbar({
          kind: 'info',
          title: t('shrExistingVisitReused', 'Reusing this patient’s open SHR visit'),
          subtitle: t(
            'shrExistingVisitReusedDetail',
            'They already consented at this facility, so no new OTP is needed.',
          ),
        });
        handleConsentGranted({ consentToken: active.consentToken, visitId: active.visitId });
        return;
      }
    } catch (err: any) {
      // Not fatal: the consent request below is the fallback either way.
      console.error(err);
    }
    setPhase('idle');
    void launchConsentWorkspace();
  }, [crId, locationUuid, handleConsentGranted, launchConsentWorkspace, t]);

  const openCloseForm = useCallback(() => {
    setCloseError('');
    setClosePatientIncapable(false);
    setCloseIncapacityReason('');
    setIsCloseFormOpen(true);
  }, []);

  const cancelCloseForm = useCallback(() => {
    setIsCloseFormOpen(false);
    setCloseError('');
  }, []);

  /** Everything that stops being true once the visit is really closed. */
  const settleAsClosed = useCallback((endDate: string) => {
    setClosedOn(endDate);
    setGrant(null);
    setRecordSet(null);
    setSyncError('');
    setPendingClose(null);
    setCloseOtp('');
    setIsCloseFormOpen(false);
    setPhase('closed');
  }, []);

  /**
   * Request the closure. Two documented outcomes, and the response says which:
   * `end_date` means the visit is already closed, `otp_record` means a password
   * went out and the visit is **still open** until it is verified. Treating the
   * second as done would leave a live visit behind, showing "closed".
   */
  const handleConfirmClose = useCallback(async () => {
    if (!grant?.visitId) {
      return;
    }
    // `patientIncapable: 1` — the patient cannot consent to the closure. The
    // consent request spells the same idea `patientCapable: 0`; the polarity is
    // inverted between the two endpoints.
    if (closePatientIncapable && !closeIncapacityReason.trim()) {
      return;
    }
    setIsClosing(true);
    setCloseError('');
    try {
      const response = await closeShrVisit(
        grant.visitId,
        locationUuid,
        closePatientIncapable ? { patientIncapable: 1, incapacityReason: closeIncapacityReason.trim() } : {},
      );

      if (response?.end_date) {
        showSnackbar({
          kind: 'success',
          title: t('shrVisitClosed', 'SHR visit closed'),
          subtitle: response?.message || t('shrVisitClosureAccepted', 'The closure request was accepted.'),
        });
        settleAsClosed(response.end_date);
        return;
      }

      if (response?.otp_record && response?.consent_id) {
        showSnackbar({
          kind: 'info',
          title: t('shrClosureOtpSent', 'Closure OTP sent'),
          subtitle: t('shrClosureOtpSentDetail', 'The visit stays open until that code is entered.'),
        });
        setPendingClose({ consentId: response.consent_id, otpRecord: response.otp_record });
        setCloseOtp('');
        setIsCloseFormOpen(false);
        setPhase('closing-otp');
        return;
      }

      // Neither field: nothing can be concluded about the visit, so don't
      // pretend either way.
      setCloseError(
        response?.message ||
          t('shrCloseVisitIndeterminate', 'The SHR service did not say whether the visit closed. Try again.'),
      );
    } catch (err: any) {
      setCloseError(extractShrErrorDetail(err?.message ?? ''));
    } finally {
      setIsClosing(false);
    }
  }, [grant, locationUuid, closePatientIncapable, closeIncapacityReason, settleAsClosed, t]);

  /**
   * Complete an OTP-gated closure. Same verify endpoint as a consent, told apart
   * server-side by the `otp_record` having come from the close call — the
   * response carries `end_date` instead of a token.
   */
  const handleVerifyClose = useCallback(async () => {
    if (!pendingClose || closeOtp.trim().length < OTP_LENGTH) {
      return;
    }
    setIsClosing(true);
    setCloseError('');
    try {
      const response = await verifyConsentOtp(pendingClose.consentId, {
        otp: closeOtp,
        otpRecord: pendingClose.otpRecord,
        locationUuid,
        crId,
      });
      if (!response?.end_date) {
        throw new Error(
          t('shrClosureNotConfirmed', 'That code did not close the visit. Check it with the patient and try again.'),
        );
      }
      showSnackbar({
        kind: 'success',
        title: t('shrVisitClosed', 'SHR visit closed'),
        subtitle: response?.message || t('shrVisitClosureAccepted', 'The closure request was accepted.'),
      });
      settleAsClosed(response.end_date);
    } catch (err: any) {
      setCloseError(extractShrErrorDetail(err?.message ?? ''));
    } finally {
      setIsClosing(false);
    }
  }, [pendingClose, closeOtp, locationUuid, crId, settleAsClosed, t]);

  const handleStartNewRequest = useCallback(() => {
    setPhase('idle');
    setGrant(null);
    setRecordSet(null);
    setFetchError('');
    setSyncError('');
    setCloseError('');
    setClosedOn('');
    setDeclined(null);
    setPendingClose(null);
    setCloseOtp('');
    setIsCloseFormOpen(false);
    void startShrSession();
  }, [startShrSession]);

  const closeVisitForm = isCloseFormOpen ? (
    <ShrCloseVisitForm
      patientIncapable={closePatientIncapable}
      incapacityReason={closeIncapacityReason}
      isClosing={isClosing}
      error={closeError}
      onPatientIncapableChange={setClosePatientIncapable}
      onIncapacityReasonChange={setCloseIncapacityReason}
      onConfirm={() => void handleConfirmClose()}
      onCancel={cancelCloseForm}
    />
  ) : null;

  if (isPatientLoading && !patientUuid) {
    return (
      <div className={styles.container}>
        <div className={styles.statusView}>
          <InlineLoading description={t('loadingPatient', 'Loading patient…')} />
        </div>
      </div>
    );
  }

  if (!patientUuid) {
    return (
      <div className={styles.container}>
        <StatusView
          icon={<DocumentBlank size={32} className={styles.iconMuted} />}
          title={t('noPatientSelected', 'No patient selected')}
          text={t('shrNeedsPatient', 'Open a patient chart to request their shared health record.')}
        />
      </div>
    );
  }

  if (crStatus === 'loading') {
    return (
      <div className={styles.container}>
        <div className={styles.statusView}>
          <InlineLoading description={t('shrCheckingRegistry', 'Checking the patient’s registry number…')} />
        </div>
      </div>
    );
  }

  if (crStatus === 'error') {
    return (
      <div className={styles.container}>
        <StatusView
          icon={<ErrorFilled size={32} className={styles.iconDanger} />}
          title={t('shrCrLookupFailed', "Couldn't read the patient's registry number")}
          text={crError}
        />
      </div>
    );
  }

  if (crStatus === 'missing') {
    return (
      <div className={styles.container}>
        <StatusView
          icon={<DocumentBlank size={32} className={styles.iconMuted} />}
          title={t('shrNoCrNumber', 'No Client Registry number')}
          text={t(
            'shrNoCrNumberDetail',
            'This patient has no Client Registry number, so their national records cannot be requested. Register them with the Client Registry first.',
          )}
        />
      </div>
    );
  }

  // A site can configure the viewer's categories away entirely; requesting no
  // resource types would fetch nothing, so say so rather than showing an empty tab strip.
  if (!resourceTypes.length) {
    return (
      <div className={styles.container}>
        <StatusView
          icon={<DocumentBlank size={32} className={styles.iconMuted} />}
          title={t('shrNoCategoriesConfigured', 'No SHR categories configured')}
          text={t(
            'shrNoCategoriesConfiguredDetail',
            'No FHIR resource types are configured for the shared health record viewer. Set shrResourceTypes in this module\u2019s configuration.',
          )}
        />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {phase === 'idle' && (
        <StatusView
          icon={<Security size={32} className={styles.iconAccent} />}
          title={t('shrNoActiveSession', 'No active SHR session')}
          text={t(
            'shrIdleDetail',
            "Start a shared health record request to fetch this patient's national records for the current visit.",
          )}
          actions={
            <Button kind="primary" size="md" renderIcon={Security} onClick={() => void startShrSession()}>
              {t('initiateShrRequest', 'Initiate SHR request')}
            </Button>
          }
        />
      )}

      {phase === 'checking' && (
        <div className={styles.statusView}>
          <InlineLoading description={t('shrCheckingOpenVisit', 'Checking for an open SHR visit…')} />
        </div>
      )}

      {phase === 'fetching' && (
        <div className={styles.statusView}>
          <InlineLoading description={t('shrFetchingRecords', 'Fetching records from the shared health record…')} />
        </div>
      )}

      {phase === 'records' && recordSet && grant && (
        <ShrViewer
          recordSet={recordSet}
          resourceTypes={resourceTypes}
          visitId={grant.visitId}
          syncedAt={syncedAt}
          isSyncing={isSyncing}
          isClosing={isClosing}
          closeError={closeError}
          syncError={syncError}
          onSync={() => void loadRecords(grant, { isSync: true })}
          onCloseVisit={openCloseForm}
          closePanel={closeVisitForm}
        />
      )}

      {phase === 'empty' && grant && (
        <StatusView
          icon={<DocumentBlank size={32} className={styles.iconMuted} />}
          title={t('shrNoRecordsFound', 'No shared records found')}
          text={t(
            'shrNoRecordsDetail',
            'The SHR returned no records for this client for the requested categories. You can retry or close the visit.',
          )}
          notice={
            closeError && !isCloseFormOpen
              ? { title: t('shrCloseVisitFailed', "Couldn't close the visit."), detail: closeError }
              : undefined
          }
          actions={
            closeVisitForm ?? (
              <>
                <Button
                  kind="primary"
                  size="md"
                  onClick={() => void loadRecords(grant, { isSync: false })}
                  disabled={isClosing}
                >
                  {t('retry', 'Retry')}
                </Button>
                <Button kind="tertiary" size="md" onClick={openCloseForm} disabled={isClosing}>
                  {isClosing ? t('closing', 'Closing…') : t('closeVisit', 'Close visit')}
                </Button>
              </>
            )
          }
        />
      )}

      {phase === 'error' && (
        <StatusView
          icon={<ErrorFilled size={32} className={styles.iconDanger} />}
          title={t('shrLoadFailed', "Couldn't load records")}
          text={
            fetchError ||
            t(
              'shrLoadFailedDetail',
              'The consent token may have expired, or the SHR service is unreachable. Try again, or start a new request.',
            )
          }
          actions={
            <>
              {grant && (
                <Button kind="primary" size="md" onClick={() => void loadRecords(grant, { isSync: false })}>
                  {t('retry', 'Retry')}
                </Button>
              )}
              <Button kind="tertiary" size="md" onClick={handleStartNewRequest}>
                {t('startNewRequest', 'Start new request')}
              </Button>
            </>
          }
        />
      )}

      {phase === 'closing-otp' && (
        <StatusView
          icon={<Security size={32} className={styles.iconAccent} />}
          title={t('shrClosureAwaitingOtp', 'Closure awaiting confirmation')}
          text={t(
            'shrClosureAwaitingOtpDetail',
            'A code was sent to whoever gave consent. The visit stays open until it is entered.',
          )}
          notice={
            closeError
              ? { title: t('shrClosureVerifyFailed', "Couldn't confirm the closure."), detail: closeError }
              : undefined
          }
          actions={
            <div className={styles.closeOtp}>
              <div className={styles.otpField}>
                <FormLabel>{t('otpCode', 'OTP code')}</FormLabel>
                <OTPInput otpLength={OTP_LENGTH} onChange={setCloseOtp} disabled={isClosing} />
              </div>
              <Button
                kind="primary"
                size="md"
                onClick={() => void handleVerifyClose()}
                disabled={isClosing || closeOtp.trim().length < OTP_LENGTH}
              >
                {isClosing ? (
                  <InlineLoading description={t('verifying', 'Verifying…')} />
                ) : (
                  t('shrConfirmClosure', 'Confirm closure')
                )}
              </Button>
            </div>
          }
        />
      )}

      {phase === 'declined' && (
        <StatusView
          icon={<WarningAltFilled size={32} className={styles.iconWarning} />}
          title={t('shrConsentDeclined', 'Consent declined')}
          text={
            declined?.rejectionReason
              ? t('shrConsentDeclinedWithReason', 'This visit was not opened. Reason given: {{reason}}', {
                  reason: declined.rejectionReason,
                })
              : t('shrConsentDeclinedDetail', 'This visit was not opened and no records were fetched.')
          }
          actions={
            <Button kind="primary" size="md" renderIcon={Security} onClick={handleStartNewRequest}>
              {t('startNewShrRequest', 'Start new SHR request')}
            </Button>
          }
        />
      )}

      {phase === 'closed' && (
        <StatusView
          icon={<CheckmarkFilled size={32} className={styles.iconSuccess} />}
          title={t('visitClosed', 'Visit closed')}
          text={
            closedOn
              ? t('shrVisitClosedOn', 'SHR access has ended for this session. Closed · {{date}}', {
                  date: formatMoment(closedOn),
                })
              : t('shrVisitClosedDetail', 'SHR access has ended for this session.')
          }
          actions={
            <Button kind="primary" size="md" renderIcon={Security} onClick={handleStartNewRequest}>
              {t('startNewShrRequest', 'Start new SHR request')}
            </Button>
          }
        />
      )}
    </div>
  );
};

/** Shared centred layout for the idle / empty / error / closed states. */
const StatusView: React.FC<{
  icon: React.ReactNode;
  title: string;
  text?: string;
  notice?: { title: string; detail: string };
  actions?: React.ReactNode;
}> = ({ icon, title, text, notice, actions }) => (
  <div className={styles.statusView}>
    {icon}
    <h4 className={styles.statusTitle}>{title}</h4>
    {text && <p className={styles.statusText}>{text}</p>}
    {notice && (
      <div className={styles.statusNotice}>
        <InlineNotification kind="error" lowContrast hideCloseButton title={notice.title} subtitle={notice.detail} />
      </div>
    )}
    {actions && <div className={styles.statusActions}>{actions}</div>}
  </div>
);

export default SharedHealthRecord;
