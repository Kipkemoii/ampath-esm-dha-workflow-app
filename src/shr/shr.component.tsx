import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, InlineLoading, InlineNotification } from '@carbon/react';
import { CheckmarkFilled, DocumentBlank, ErrorFilled, Security } from '@carbon/react/icons';
import { launchWorkspace2, showSnackbar, useConfig, usePatient, useSession } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { closeShrVisit, extractShrErrorDetail, fetchPatientRecords, getPatientCrIdentifier } from './shr.resource';
import type { ShrConsentGrant, ShrRecordSet } from './shr.types';
import ShrViewer from './shr-viewer/shr-viewer.component';
import { formatMoment } from './shr-viewer/shr-presentation';
import { SHR_CONSENT_WORKSPACE } from './workspaces/shr-consent-workspace/shr-consent.workspace';
import styles from './shr.scss';

/**
 * Shared Health Record tab for the patient chart.
 *
 * Owns the session state machine around the consent workspace: the workspace's
 * only job is producing a `{ consentToken, visitId }`; everything after that —
 * fetching the records, rendering them, and closing the SHR visit — happens
 * here. Nothing is fetched before consent is granted, because the records
 * endpoint requires the consent token.
 *
 *   idle → (consent workspace) → fetching → records | empty | error
 *                                              ↓ close visit
 *                                            closed → idle
 */

type Phase = 'idle' | 'fetching' | 'records' | 'empty' | 'error' | 'closed';
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
          resourceTypes: resourceTypes.map((entry) => entry.resourceType),
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
      void loadRecords(granted, { isSync: false });
    },
    [loadRecords],
  );

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
        onConsentGranted: handleConsentGranted,
      });
    } catch (err: any) {
      console.error(err);
      showSnackbar({
        kind: 'error',
        title: t('shrConsentWorkspaceFailed', "Couldn't open the SHR consent form"),
        subtitle: err?.message ?? '',
      });
    }
  }, [crId, locationUuid, handleConsentGranted, t]);

  const handleCloseVisit = useCallback(async () => {
    if (!grant?.visitId) {
      return;
    }
    setIsClosing(true);
    setCloseError('');
    try {
      const response = await closeShrVisit(grant.visitId, locationUuid);
      showSnackbar({
        kind: 'success',
        title: t('shrVisitClosed', 'SHR visit closed'),
        subtitle: response?.message || t('shrVisitClosureAccepted', 'The closure request was accepted.'),
      });
      setClosedOn(response?.end_date ?? '');
      setGrant(null);
      setRecordSet(null);
      setSyncError('');
      setPhase('closed');
    } catch (err: any) {
      setCloseError(extractShrErrorDetail(err?.message ?? ''));
    } finally {
      setIsClosing(false);
    }
  }, [grant, locationUuid, t]);

  const handleStartNewRequest = useCallback(() => {
    setPhase('idle');
    setGrant(null);
    setRecordSet(null);
    setFetchError('');
    setSyncError('');
    setCloseError('');
    setClosedOn('');
    void launchConsentWorkspace();
  }, [launchConsentWorkspace]);

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
            <Button kind="primary" size="md" renderIcon={Security} onClick={() => void launchConsentWorkspace()}>
              {t('initiateShrRequest', 'Initiate SHR request')}
            </Button>
          }
        />
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
          onCloseVisit={() => void handleCloseVisit()}
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
            closeError
              ? { title: t('shrCloseVisitFailed', "Couldn't close the visit."), detail: closeError }
              : undefined
          }
          actions={
            <>
              <Button
                kind="primary"
                size="md"
                onClick={() => void loadRecords(grant, { isSync: false })}
                disabled={isClosing}
              >
                {t('retry', 'Retry')}
              </Button>
              <Button kind="tertiary" size="md" onClick={() => void handleCloseVisit()} disabled={isClosing}>
                {isClosing ? t('closing', 'Closing…') : t('closeVisit', 'Close visit')}
              </Button>
            </>
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
