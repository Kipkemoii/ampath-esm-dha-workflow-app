import React, { useEffect, useMemo, useState } from 'react';
import styles from './claims-stats-dashboard.component.scss';
import { fethClaimVisits } from '../../../billing-claims.resource';
import { ClaimPayerStatus, ClaimProviderStatus } from '../types';
import ClaimStatsListModal from './modal/claim-stats-list/claim-stats-list.modal';
import ClaimStat from './claim-stat/claim-stat.component';
import { type ClaimVisit, type FetchClaimVisitDto } from '../../../types';
import { showSnackbar } from '@openmrs/esm-framework';
interface ClaimsStatsDashboardProps {
  reportDate: string;
  locationUuid: string;
}
const ClaimsStatsDashboard: React.FC<ClaimsStatsDashboardProps> = ({ locationUuid, reportDate }) => {
  const [claimVisits, setClaimVisits] = useState<ClaimVisit[]>([]);
  const [showClaimsListModal, setShowClaimsListModal] = useState<boolean>(false);
  const [selectedIndicator, setSelectedIndicator] = useState<string>('');
  const [selectedClaims, setSelectedClaims] = useState<ClaimVisit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const draftClaims: ClaimVisit[] = useMemo(() => getClaimByType(ClaimProviderStatus.Draft), [claimVisits]);
  const closedClaims: ClaimVisit[] = useMemo(() => getClaimByType(ClaimProviderStatus.Closed), [claimVisits]);
  const submissionReadyClaims: ClaimVisit[] = useMemo(
    () => getClaimByType(ClaimProviderStatus.SubmissionReady),
    [claimVisits],
  );
  const submittedClaims: ClaimVisit[] = useMemo(() => getClaimByType(ClaimProviderStatus.Submitted), [claimVisits]);
  const rejectedClaims: ClaimVisit[] = useMemo(
    () => getClaimByType(ClaimProviderStatus.Submitted, ClaimPayerStatus.Rejected),
    [claimVisits],
  );
  const approvedClaims: ClaimVisit[] = useMemo(
    () => getClaimByType(ClaimProviderStatus.Submitted, ClaimPayerStatus.Approved),
    [claimVisits],
  );
  const paidClaims: ClaimVisit[] = useMemo(
    () => getClaimByType(ClaimProviderStatus.Submitted, ClaimPayerStatus.Paid),
    [claimVisits],
  );
  useEffect(() => {
    if (locationUuid && reportDate) {
      getClaimVisits();
    }
  }, [locationUuid, reportDate]);
  function handleIndicatorSelection(indicator: ClaimProviderStatus | ClaimPayerStatus | 'Total' | string) {
    setSelectedIndicator(indicator);
    let claims: ClaimVisit[] = [];
    switch (indicator) {
      case 'Total':
        claims = claimVisits;
        break;
      case ClaimProviderStatus.Closed:
        claims = closedClaims;
        break;
      case ClaimProviderStatus.Draft:
        claims = draftClaims;
        break;
      case ClaimProviderStatus.SubmissionReady:
        claims = submissionReadyClaims;
        break;
      case ClaimProviderStatus.Submitted:
        claims = submittedClaims;
        break;
      case ClaimPayerStatus.Approved:
        claims = approvedClaims;
        break;
      case ClaimPayerStatus.Rejected:
        claims = rejectedClaims;
        break;
      case ClaimPayerStatus.Paid:
        claims = paidClaims;
        break;
      default:
        claims = [];
    }
    setSelectedClaims(claims);
    setShowClaimsListModal(true);
  }
  function handleCloseClaimStatsListModal() {
    setShowClaimsListModal(false);
  }
  async function getClaimVisits() {
    const claimVisitsPayload = getClaimVisitsPayload();
    try {
      const resp = await fethClaimVisits(claimVisitsPayload);
      if (resp) {
        setClaimVisits(resp);
      } else {
        setClaimVisits([]);
      }
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'A fetching claim data',
        subtitle: 'An error occurred while fetching claim data, please reload or contact support',
      });
    }
  }
  function getClaimVisitsPayload(): FetchClaimVisitDto {
    return {
      locationUuid: locationUuid,
      visitDate: reportDate,
    };
  }

  function getClaimByType(providerStatus: string, payerStatus?: string) {
    return claimVisits.filter((v) => {
      if (providerStatus && !payerStatus) {
        return v.providerStatus === providerStatus;
      } else if (providerStatus && payerStatus) {
        return v.providerStatus === providerStatus && v.payerStatus === payerStatus;
      } else {
        return true;
      }
    });
  }

  return (
    <>
      <div className={styles.claimStatsLayout}>
        <div className={styles.claimStatsHeader}>
          <h4>Claim Statistics</h4>
        </div>
        <div className={styles.summaryRow}>
          <ClaimStat title="Total" count={claimVisits.length} onStatClick={handleIndicatorSelection} />
          <ClaimStat
            title={ClaimProviderStatus.Draft}
            count={draftClaims.length}
            onStatClick={handleIndicatorSelection}
          />
          <ClaimStat
            title={ClaimProviderStatus.Closed}
            count={closedClaims.length}
            onStatClick={handleIndicatorSelection}
          />
          <ClaimStat
            title={ClaimProviderStatus.SubmissionReady}
            count={submissionReadyClaims.length}
            onStatClick={handleIndicatorSelection}
          />
          <ClaimStat
            title={ClaimProviderStatus.Submitted}
            count={submittedClaims.length}
            onStatClick={handleIndicatorSelection}
          />
          <ClaimStat
            title={ClaimPayerStatus.Approved}
            count={approvedClaims.length}
            onStatClick={handleIndicatorSelection}
          />
          <ClaimStat
            title={ClaimPayerStatus.Rejected}
            count={rejectedClaims.length}
            onStatClick={handleIndicatorSelection}
          />
          <ClaimStat title={ClaimPayerStatus.Paid} count={paidClaims.length} onStatClick={handleIndicatorSelection} />
        </div>
      </div>
      {showClaimsListModal && selectedIndicator && (
        <ClaimStatsListModal
          open={showClaimsListModal}
          indicator={selectedIndicator}
          onCloseClaimStatsListModal={handleCloseClaimStatsListModal}
          claimVisits={selectedClaims}
        />
      )}
    </>
  );
};

export default ClaimsStatsDashboard;
