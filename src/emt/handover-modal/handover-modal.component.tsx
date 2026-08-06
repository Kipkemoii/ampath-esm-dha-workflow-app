import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ModalBody, TextInput, Button, InlineLoading, Tag, ComboBox, Dropdown } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import OTPInput from '../../shared/ui/otp-input/otp-input.component';
import {
  initiateHandover,
  verifyHandoverOtp,
  getHandoverRequestId,
} from '../emt.resource';
import { EmtApiError, type EmtReferralRow, type ReceivingDoctor } from '../types/emt.types';
import {
  searchOpenMrsProviders,
  searchHealthWorkerRegistry,
  type OpenMrsProviderHit,
  type HwrSearchResult,
} from '../../billing/dashboard/v3/preauth/preauth.resource';
import styles from './handover-modal.scss';

type Step = 'doctor' | 'confirm' | 'otp';

/** Identifier type understood by the Health Worker Registry practitioner search. */
const HWR_IDENTIFIER_TYPE = 'National ID';

const REGULATION_BODIES = ['KMPDC', 'COC', 'NCK'] as const;
type RegulationBody = (typeof REGULATION_BODIES)[number];

/** Map a raw HWR `licensing_body` string onto one of the three regulators the EMT API accepts. */
const normalizeRegulationBody = (value?: string | null): RegulationBody => {
  if (!value) return 'KMPDC';
  const raw = value.trim();
  const exact = REGULATION_BODIES.find((b) => b.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const upper = raw.toUpperCase();
  if (upper.includes('KMPDC') || upper.includes('MEDICAL PRACTITIONER') || upper.includes('DOCTOR')) return 'KMPDC';
  if (upper.includes('CLINICAL OFFICER') || upper === 'COC' || upper.includes('CLINICAL OFFICERS COUNCIL')) return 'COC';
  if (upper.includes('NURS') || upper === 'NCK') return 'NCK';
  return 'KMPDC';
};

interface HandoverModalProps {
  open: boolean;
  referral: EmtReferralRow;
  locationUuid: string;
  onModalClose: () => void;
  /** Fired after a successful verify — caller refreshes the queue + launches the visit. */
  onHandoverComplete: (referral: EmtReferralRow) => void;
  /** Fired when the upstream 404s — the referral is gone (handled elsewhere); caller drops it. */
  onReferralUnavailable: (referral: EmtReferralRow, reason: string) => void;
}

/**
 * OTP-verified handover flow for an EMT referral:
 *
 *   doctor   (resolve the receiving clinician's regulatory identifier)
 *     → confirm (shows patient/case/receiving doctor)
 *     → initiate (POST /handover/initiate)  — "Sending OTP to doctor…"
 *     → OTP entry
 *     → verify (POST /handover/verify)
 *     → onHandoverComplete (queue refresh + visit launch)
 *
 * The doctor step reuses the preauth mechanism: search OpenMRS providers by name,
 * auto-pull the provider's National ID attribute, then look that National ID up in
 * the Health Worker Registry to obtain the registration number + licensing body.
 *
 * Each upstream failure mode gets a distinct, user-readable message. An
 * invalid/expired OTP keeps the modal open so the user can retry or re-initiate.
 * A 404 means the referral no longer exists, so the parent is told to drop it
 * rather than leaving the user stuck on a step that can never succeed.
 */
const HandoverModal: React.FC<HandoverModalProps> = ({
  open,
  referral,
  locationUuid,
  onModalClose,
  onHandoverComplete,
  onReferralUnavailable,
}) => {
  const [step, setStep] = useState<Step>('doctor');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // --- receiving doctor resolution (doctor step) ---
  const [providerQuery, setProviderQuery] = useState('');
  const [providerHits, setProviderHits] = useState<OpenMrsProviderHit[]>([]);
  const [searchingProviders, setSearchingProviders] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<OpenMrsProviderHit | null>(null);
  const providerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [doctorNationalId, setDoctorNationalId] = useState('');
  const [searchingHwr, setSearchingHwr] = useState(false);
  const [hwrHit, setHwrHit] = useState<HwrSearchResult | null>(null);
  const [regulationBody, setRegulationBody] = useState<RegulationBody>('KMPDC');
  const [doctorSearchError, setDoctorSearchError] = useState('');

  useEffect(
    () => () => {
      if (providerSearchTimer.current) {
        clearTimeout(providerSearchTimer.current);
      }
    },
    [],
  );

  /** Only a HWR hit carrying a registration number yields a usable receiving doctor. */
  const resolvedDoctor: ReceivingDoctor | null = useMemo(() => {
    const regId = hwrHit?.membership?.registration_id?.trim();
    if (!regId) return null;
    return {
      name: hwrHit?.membership?.full_name || selectedProvider?.display || 'Receiving clinician',
      identifier: regId,
      identifier_type: 'registration_number',
      regulator: regulationBody,
    };
  }, [hwrHit, selectedProvider, regulationBody]);

  const reset = () => {
    if (providerSearchTimer.current) {
      clearTimeout(providerSearchTimer.current);
      providerSearchTimer.current = null;
    }
    setStep('doctor');
    setOtp('');
    setLoading(false);
    setError('');
    setProviderQuery('');
    setProviderHits([]);
    setSearchingProviders(false);
    setSelectedProvider(null);
    setDoctorNationalId('');
    setSearchingHwr(false);
    setHwrHit(null);
    setRegulationBody('KMPDC');
    setDoctorSearchError('');
  };

  const handleClose = () => {
    reset();
    onModalClose();
  };

  const showAlert = (kind: 'success' | 'error' | 'info' | 'warning', title: string, subtitle = '') =>
    showSnackbar({ kind, title, subtitle });

  // Map an EMT error to a human-readable message, branchable by status.
  const describeError = (err: unknown, fallback: string): string => {
    if (err instanceof EmtApiError) {
      const { status } = err;
      if (status === 400 || status === 422) return err.message || 'Some details were invalid. Please check and retry.';
      if (status === 401 || status === 403) return 'Your session may have expired. Please re-authenticate and retry.';
      if (status === 404) return 'This referral can no longer be found — it may have been handled elsewhere.';
      if (status === 409) return 'A handover has already been initiated or completed for this case.';
      if (status === 410) return 'This OTP has expired. Please re-initiate the handover.';
      if (status >= 500) return 'The EMT service is temporarily unavailable. Please retry shortly.';
    }
    return err instanceof Error ? err.message || fallback : fallback;
  };

  // ---------------------------------------------------------------- doctor step

  const providerItemLabel = (item: OpenMrsProviderHit | null) =>
    item ? (item.nationalId ? `${item.display} · ${item.nationalId}` : item.display) : '';

  const handleSearchHwr = async (idOverride?: string) => {
    const idValue = (idOverride ?? doctorNationalId).trim();
    if (!idValue) {
      setDoctorSearchError('Enter the doctor National ID to look up the Health Worker Registry.');
      return;
    }
    setSearchingHwr(true);
    setDoctorSearchError('');
    try {
      const results = await searchHealthWorkerRegistry({
        identifierType: HWR_IDENTIFIER_TYPE,
        identifierValue: idValue,
        locationUuid,
      });
      const hit = results[0];
      if (!hit) {
        setHwrHit(null);
        setDoctorSearchError('No health worker record found for this National ID.');
        showAlert('warning', 'No health worker found', `National ID ${idValue} is not in the registry.`);
        return;
      }
      // Keep the hit either way so the matched name is visible, but only a
      // registration number makes the doctor usable for the handover.
      setHwrHit(hit);
      if (!hit.membership?.registration_id?.trim()) {
        setDoctorSearchError('This health worker has no registration number on file — cannot proceed.');
        return;
      }
      const body = normalizeRegulationBody(hit.membership?.licensing_body);
      setRegulationBody(body);
      setDoctorSearchError('');
      showAlert(
        'success',
        'Receiving doctor resolved',
        `${hit.membership?.full_name || 'Match'} · ${body} ${hit.membership.registration_id}`,
      );
    } catch (err) {
      setHwrHit(null);
      const message = describeError(err, 'Health Worker Registry search failed.');
      setDoctorSearchError(message);
      showAlert('error', 'HWR search failed', message);
    } finally {
      setSearchingHwr(false);
    }
  };

  const applyProviderSelection = (hit: OpenMrsProviderHit | null) => {
    setSelectedProvider(hit);
    if (!hit) return;
    if (hit.nationalId) {
      setDoctorNationalId(hit.nationalId);
      setDoctorSearchError('');
      void handleSearchHwr(hit.nationalId);
    } else {
      setDoctorNationalId('');
      setHwrHit(null);
      setDoctorSearchError('No National ID on file for this provider — enter it manually and search HWR.');
    }
  };

  const handleProviderInputChange = (inputValue: string) => {
    setProviderQuery(inputValue);
    const selectedLabel = providerItemLabel(selectedProvider);
    if (inputValue === selectedLabel) {
      return;
    }
    if (selectedProvider) {
      setSelectedProvider(null);
    }
    if (providerSearchTimer.current) {
      clearTimeout(providerSearchTimer.current);
    }
    if (!inputValue || inputValue.trim().length < 2) {
      setProviderHits([]);
      setSearchingProviders(false);
      return;
    }
    providerSearchTimer.current = setTimeout(async () => {
      setSearchingProviders(true);
      try {
        const hits = await searchOpenMrsProviders(inputValue);
        setProviderHits(hits);
      } catch (err) {
        setProviderHits([]);
        const message = describeError(err, 'Provider search failed.');
        setDoctorSearchError(message);
        showAlert('error', 'Provider search failed', message);
      } finally {
        setSearchingProviders(false);
      }
    }, 300);
  };

  // ------------------------------------------------------------- handover steps

  const handleInitiate = async () => {
    if (!resolvedDoctor) {
      // Continue is gated on this, so this is a defensive fallback only.
      setStep('doctor');
      setDoctorSearchError('Resolve the receiving doctor before sending the OTP.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await initiateHandover({
        incidence_number: referral.case_number,
        identifier: resolvedDoctor.identifier,
        identifier_type: resolvedDoctor.identifier_type,
        regulator: resolvedDoctor.regulator,
      });
      const requestId = getHandoverRequestId(res);
      if (!requestId) {
        // The response shape didn't carry a request id — surface rather than guess.
        throw new EmtApiError(
          0,
          'Handover was initiated but no request id was returned. Please retry or contact support.',
        );
      }
      // Stash the request id on the referral object for the verify call.
      (referral as EmtReferralRow & { _request_id?: string })._request_id = requestId;
      setStep('otp');
      showAlert('info', 'OTP sent', `A code was sent to ${resolvedDoctor.name}.`);
    } catch (err) {
      const message = describeError(err, 'Failed to initiate handover.');
      if (err instanceof EmtApiError && err.status === 404) {
        // The referral is gone — the parent closes this modal and drops the row.
        onReferralUnavailable(referral, message);
        return;
      }
      setError(message);
      showAlert('error', 'Handover failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    setError('');
    try {
      const requestId = (referral as EmtReferralRow & { _request_id?: string })._request_id ?? '';
      if (!requestId) {
        // Lost the request id (e.g. modal reopened) — go back to initiate.
        setStep('confirm');
        setError('The handover session was lost. Please re-initiate.');
        return;
      }
      await verifyHandoverOtp({
        incidence_number: referral.case_number,
        request_id: requestId,
        otp,
      });
      showAlert(
        'success',
        'Handover complete',
        `${referral.patientName} (${referral.case_number}) has been handed over.`,
      );
      reset();
      onHandoverComplete(referral);
    } catch (err) {
      const message = describeError(err, 'OTP verification failed.');
      if (err instanceof EmtApiError && err.status === 404) {
        // The referral is gone — the parent closes this modal and drops the row.
        onReferralUnavailable(referral, message);
        return;
      }
      setError(message);
      showAlert('error', 'Verification failed', message);
      // Stay on the OTP step so the user can retry / re-initiate.
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    // Re-initiate (re-sends the OTP). The backend exposes no dedicated resend,
    // so we call initiate again as the resend affordance.
    setStep('confirm');
    setOtp('');
    setError('');
    await handleInitiate();
  };

  const patientLine = referral.patientName || referral.cr_id;

  const modalHeading =
    step === 'doctor' ? 'Select receiving doctor' : step === 'confirm' ? 'Confirm handover' : 'Enter doctor OTP';

  return (
    <Modal
      open={open}
      modalHeading={modalHeading}
      passiveModal={false}
      size="sm"
      onRequestClose={handleClose}
      preventCloseOnClickOutside
    >
      <ModalBody>
        {step === 'doctor' && (
          <div className={styles.doctorBody}>
            <p className={styles.confirmText}>
              Search for the receiving clinician to resolve their regulatory registration number. The
              handover OTP is sent to this doctor.
            </p>

            <div className={styles.searchBlock}>
              <ComboBox
                id="emt-handover-provider"
                titleText="Provider"
                placeholder="Type at least 2 characters to search"
                items={providerHits}
                itemToString={providerItemLabel}
                selectedItem={selectedProvider}
                shouldFilterItem={() => true}
                onInputChange={handleProviderInputChange}
                onChange={({ selectedItem }) => applyProviderSelection(selectedItem as OpenMrsProviderHit | null)}
              />
              {searchingProviders ? <InlineLoading description="Searching providers…" /> : null}
              {!searchingProviders && !selectedProvider && providerQuery.trim().length >= 2 && !providerHits.length ? (
                <p className={styles.fieldHint}>No providers matched “{providerQuery.trim()}”.</p>
              ) : null}
            </div>

            <div className={styles.row}>
              <TextInput
                id="emt-handover-doctor-national-id"
                labelText="Doctor National ID"
                value={doctorNationalId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setDoctorNationalId(e.target.value);
                  setHwrHit(null);
                }}
              />
              <Button
                kind="tertiary"
                size="md"
                onClick={() => handleSearchHwr()}
                disabled={searchingHwr || !doctorNationalId.trim()}
              >
                {searchingHwr ? 'Searching HWR…' : 'Search HWR'}
              </Button>
            </div>

            {hwrHit ? (
              <Tag type={resolvedDoctor ? 'green' : 'red'} size="sm">
                {hwrHit.membership?.full_name || 'Match'}
                {hwrHit.membership?.registration_id ? ` · ${hwrHit.membership.registration_id}` : ' · no registration number'}
              </Tag>
            ) : null}

            {(hwrHit || selectedProvider) && (
              <div className={styles.row}>
                <Dropdown
                  id="emt-handover-reg-body"
                  titleText="Regulation body"
                  label="Select regulation body"
                  items={[...REGULATION_BODIES]}
                  selectedItem={regulationBody}
                  onChange={({ selectedItem }) => setRegulationBody(normalizeRegulationBody(selectedItem))}
                />
                <p className={styles.fieldHint}>COC = Clinical Officers Council · NCK = Nursing Council of Kenya</p>
              </div>
            )}

            {doctorSearchError && <p className={styles.errorText}>{doctorSearchError}</p>}

            <div className={styles.actions}>
              <Button kind="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button kind="primary" onClick={() => setStep('confirm')} disabled={!resolvedDoctor || searchingHwr}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className={styles.confirmBody}>
            <p className={styles.confirmText}>
              You are about to accept the handover for the following referral. An OTP will be sent to
              the receiving doctor to confirm.
            </p>
            <div className={styles.detailGrid}>
              <span className={styles.detailLabel}>Patient</span>
              <span className={styles.detailValue}>{patientLine}</span>
              <span className={styles.detailLabel}>CR ID</span>
              <span className={styles.detailValue}>{referral.cr_id}</span>
              <span className={styles.detailLabel}>Case number</span>
              <span className={styles.detailValue}>{referral.case_number}</span>
              <span className={styles.detailLabel}>Receiving doctor</span>
              <span className={styles.detailValue}>
                {resolvedDoctor?.name}{' '}
                <Tag size="sm" type="gray">
                  {resolvedDoctor?.regulator} {resolvedDoctor?.identifier}
                </Tag>
              </span>
            </div>
            {error && <p className={styles.errorText}>{error}</p>}
            <div className={styles.actions}>
              <Button kind="ghost" onClick={() => setStep('doctor')} disabled={loading}>
                Change doctor
              </Button>
              <Button kind="secondary" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              {loading ? (
                <InlineLoading description="Sending OTP to doctor…" />
              ) : (
                <Button kind="primary" onClick={handleInitiate}>
                  Send OTP
                </Button>
              )}
            </div>
          </div>
        )}

        {step === 'otp' && (
          <div className={styles.otpBody}>
            <p className={styles.confirmText}>
              Enter the OTP sent to <strong>{resolvedDoctor?.name}</strong> to complete the handover for{' '}
              {patientLine}.
            </p>
            <OTPInput otpLength={6} onChange={setOtp} />
            {error && <p className={styles.errorText}>{error}</p>}
            <div className={styles.actions}>
              <Button kind="ghost" onClick={handleResend} disabled={loading}>
                Resend OTP
              </Button>
              <Button kind="secondary" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              {loading ? (
                <InlineLoading description="Verifying…" />
              ) : (
                <Button kind="primary" onClick={handleVerify} disabled={otp.length < 4}>
                  Verify
                </Button>
              )}
            </div>
          </div>
        )}
      </ModalBody>
    </Modal>
  );
};

export default HandoverModal;
