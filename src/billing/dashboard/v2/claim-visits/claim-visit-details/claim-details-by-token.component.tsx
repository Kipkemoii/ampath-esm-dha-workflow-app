import React, { useEffect, useMemo, useState } from 'react';
import ClaimVisitDetails from './claim-visit-details.component';
import ClaimDetailsSkeleton from '../../patient-bill-details/claim-details/claim-details-skeleton.component';
import EmptyState from '../../shared/empty-state.component';
import {
  fetchMaternityDiagnosis,
  fetchPatientDiagnosis,
  fetchPatientEncounterDiagnosis,
  useProviderClaimPreview,
} from '../../../../billing-claims.resource';
import { type AmrsMaternityDiagnosisDto, type AmrsVisitDiagnosisDto, type AmrsVisitDiagnosis } from '../../../../types';
import { showSnackbar } from '@openmrs/esm-framework';

interface claimDetailsByTokenProps {
  /** The claim's consent token — its authorization code on the claims endpoints. */
  consentToken: string;
  locationUuid: string;
  patientUuid?: string;
  billingDate?: string;
}

/**
 * A claim's details loaded from its consent token alone.
 *
 * For callers holding a claim *listing* rather than a claim: the SHA claims table and
 * the claims-accounting list both know the token and nothing else. Everything shown here
 * comes from the live claim preview, so unlike the stored copy in /claims-visit its state
 * is current the moment it renders.
 */
const ClaimDetailsByToken: React.FC<claimDetailsByTokenProps> = ({
  consentToken,
  locationUuid,
  patientUuid,
  billingDate,
}) => {
  const { claimVisit, isLoading, isValidating, error } = useProviderClaimPreview(consentToken, locationUuid);
  const [encounterDiagnosis, setEncounterDiagnosis] = useState<AmrsVisitDiagnosis[]>([]);
  const [visitDiagnosis, setVisitDiagnosis] = useState<AmrsVisitDiagnosis[]>([]);
  const [maternityDiagnosis, setMaternityDiagnosis] = useState<AmrsVisitDiagnosis[]>([]);
  const patientAmrsVisitDiagnosis = useMemo(
    () => [...visitDiagnosis, ...maternityDiagnosis, ...encounterDiagnosis],
    [visitDiagnosis, maternityDiagnosis, encounterDiagnosis],
  );

  const [visitDiagnosisLoading, setVisitDiagnosisLoading] = useState<boolean>(true);
  const [maternityDiagnosisLoading, setMaternityDiagnosisLoading] = useState<boolean>(true);
  const [encounterDiagnosisLoading, setEncounterDiagnosisLoading] = useState<boolean>(true);
  const diagnosisLoading = visitDiagnosisLoading || maternityDiagnosisLoading || encounterDiagnosisLoading;

  useEffect(() => {
    if (locationUuid && patientUuid && billingDate) {
      getPatientAmrsVisitDiagnosis();
      getPatientAmrsMaternityDiagnosis();
      getPatientAmrsEncounterDiagnosis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationUuid, patientUuid, billingDate]);

  async function getPatientAmrsVisitDiagnosis() {
    setVisitDiagnosisLoading(true);
    const amrsVisitDiagnosisPayload = getPatientAmrsVisitDiagnosisPayload();
    try {
      const resp = await fetchPatientDiagnosis(amrsVisitDiagnosisPayload);
      setVisitDiagnosis(resp ?? []);
    } catch (error) {
      showSnackbar({
        title: 'Error fetching patient diagnosis',
        kind: 'error',
        subtitle: 'An error occurred while fetching the patient diagnosis',
      });
    } finally {
      setVisitDiagnosisLoading(false);
    }
  }
  async function getPatientAmrsMaternityDiagnosis() {
    setMaternityDiagnosisLoading(true);
    const amrsMaternityDiagnosisPayload = getPatientAmrsMaternityDiagnosisPayload();
    try {
      const resp: any = await fetchMaternityDiagnosis(amrsMaternityDiagnosisPayload);
      const results = (resp ?? [])
        .filter((r) => r?.uuid != null)
        .map((v) => ({ ...v, practitioner_identifier_type: 'National ID' }));
      setMaternityDiagnosis(results);
    } catch (error) {
      showSnackbar({
        title: 'Error fetching patient maternity diagnosis',
        kind: 'error',
        subtitle: 'An error occurred while fetching the patient maternity diagnosis',
      });
    } finally {
      setMaternityDiagnosisLoading(false);
    }
  }
  async function getPatientAmrsEncounterDiagnosis() {
    setEncounterDiagnosisLoading(true);
    const amrsMaternityDiagnosisPayload = getPatientAmrsVisitDiagnosisPayload();
    try {
      const resp: any = await fetchPatientEncounterDiagnosis(amrsMaternityDiagnosisPayload);
      const results = (resp ?? []).filter((r) => r?.uuid != null).map((v) => ({ ...v }));
      setEncounterDiagnosis(results);
    } catch (error) {
      showSnackbar({
        title: 'Error fetching patient encounter diagnosis',
        kind: 'error',
        subtitle: 'An error occurred while fetching the patient encounter diagnosis',
      });
    } finally {
      setEncounterDiagnosisLoading(false);
    }
  }
  function getPatientAmrsVisitDiagnosisPayload(): AmrsVisitDiagnosisDto {
    return {
      patientUuid: patientUuid,
      visitDate: billingDate,
      locationUuid: locationUuid,
    };
  }
  function getPatientAmrsMaternityDiagnosisPayload(): AmrsMaternityDiagnosisDto {
    return {
      patientUuid: patientUuid,
      billingDate: billingDate,
    };
  }

  // SWR keeps serving the previously opened claim while the next one loads, so a preview
  // only counts as this claim's when its authorization code is the token asked for.
  // Without the check, opening a second claim shows the first one's details as though
  // they were this claim's.
  const wantedToken = (consentToken ?? '').trim().toUpperCase();
  const claim =
    wantedToken && (claimVisit?.authorization_code ?? '').trim().toUpperCase() === wantedToken ? claimVisit : undefined;

  if (claim) {
    return <ClaimVisitDetails claimsVisit={claim} locationUuid={locationUuid} claimRefreshing={isValidating} />;
  }
  if (isLoading || isValidating) {
    return <ClaimDetailsSkeleton />;
  }
  return (
    <EmptyState
      message={
        error
          ? 'This claim couldn’t be loaded. Check your connection and try again.'
          : 'No claim details were returned for this visit.'
      }
    />
  );
};

export default ClaimDetailsByToken;
