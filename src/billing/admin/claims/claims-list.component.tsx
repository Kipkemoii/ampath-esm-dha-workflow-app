import React, { useEffect, useState } from 'react';
import styles from './claims-list.component.scss';
import { fethClaimVisits } from '../../billing-claims.resource';
import { type FetchClaimVisitDto, type ClaimVisit } from '../../types';
import { formatDate, parseDate, showSnackbar } from '@openmrs/esm-framework';
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { ClaimProviderStatus } from '../../dashboard/v3/types';
import CloseClaimModal from '../../dashboard/v3/claim-visits/modal/close-claim/close-claim.modal';
import ClaimDetailsModal from '../../dashboard/v3/patient-bill-details/modals/claim-details/claim-details.modal';
interface claimsListProps {
  locationUuid: string;
}
const AdminClaimsList: React.FC<claimsListProps> = ({ locationUuid }) => {
  const [claimVisits, setClaimVisits] = useState<ClaimVisit[]>([]);
  const [showCloseClaimModal, setShowCloseClaimModal] = useState<boolean>(false);
  const [selectedConsentToken, setSelectedConsentToken] = useState<string>('');
  const [showClaimDetailsModal, setShowClaimsModal] = useState<boolean>(false);
  useEffect(() => {
    if (locationUuid) {
      getClaimVisits();
    }
  }, [locationUuid]);
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
    };
  }
  function handleCloseClaim(claimVisit: ClaimVisit) {
    setSelectedConsentToken(claimVisit.authorizationCode);
    setShowCloseClaimModal(true);
  }
  function handleResubmitClaim(claimVisit: ClaimVisit) {}
  function handleSuccessfullClaimClosure() {
    setShowCloseClaimModal(false);
    setSelectedConsentToken('');
    getClaimVisits();
  }
  function refreshClaims() {
    getClaimVisits();
  }
  function handleViewModal(claimVisit: ClaimVisit) {
    setSelectedConsentToken(claimVisit.authorizationCode);
    setShowClaimsModal(true);
  }
  function handleCloseClaimDetailsModal() {
    setShowClaimsModal(false);
    setSelectedConsentToken('');
    refreshClaims();
  }
  return (
    <>
      <div className={styles.adminClaimsListLayout}>
        <div className={styles.adminClaimsListHeader}>
          <div>
            <h4>All Facility Claims List</h4>
          </div>
          <div>
            <Button kind="ghost" onChangeCapture={refreshClaims}>
              Refresh
            </Button>
          </div>
        </div>
        <div className={styles.adminClaimsLisBody}>
          <Table aria-label="table" size="lg">
            <TableHead>
              <TableRow>
                <TableHeader>#</TableHeader>
                <TableHeader>CR</TableHeader>
                <TableHeader>Visit Start</TableHeader>
                <TableHeader>Service Type</TableHeader>
                <TableHeader>Provider Status</TableHeader>
                <TableHeader>Payer Status</TableHeader>
                <TableHeader>Total Claim Amount</TableHeader>
                <TableHeader>Consent Token</TableHeader>
                <TableHeader>Action</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {claimVisits &&
                claimVisits.length &&
                claimVisits.map((v, i) => {
                  return (
                    <TableRow key={v.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{v.patientId}</TableCell>
                      <TableCell>{formatDate(parseDate(v.visitStart))}</TableCell>
                      <TableCell>{v.serviceType}</TableCell>
                      <TableCell>{v.providerStatus}</TableCell>
                      <TableCell>{v.payerStatus}</TableCell>
                      <TableCell>{v.totalClaimAmount}</TableCell>
                      <TableCell>{v.authorizationCode}</TableCell>
                      <TableCell>
                        <div className={styles.actionRow}>
                          <Button kind="primary" onClick={() => handleViewModal(v)}>
                            View
                          </Button>
                          {v.providerStatus === ClaimProviderStatus.Draft ? (
                            <>
                              <Button kind="secondary" onClick={() => handleCloseClaim(v)}>
                                Close
                              </Button>
                            </>
                          ) : (
                            <></>
                          )}
                          {v.providerStatus === ClaimProviderStatus.FailedToSubmit ? (
                            <>
                              <Button kind="tertiary" onClick={() => handleResubmitClaim(v)}>
                                Resubmit
                              </Button>
                            </>
                          ) : (
                            <></>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </div>

      {showCloseClaimModal && (
        <CloseClaimModal
          open={showCloseClaimModal}
          locationUuid={locationUuid}
          consentToken={selectedConsentToken}
          onClose={handleSuccessfullClaimClosure}
          onSuccess={handleSuccessfullClaimClosure}
        />
      )}
      {showClaimDetailsModal && (
        <ClaimDetailsModal
          open={showClaimDetailsModal}
          locationUuid={locationUuid}
          consentToken={selectedConsentToken}
          onClose={handleCloseClaimDetailsModal}
        />
      )}
    </>
  );
};

export default AdminClaimsList;
