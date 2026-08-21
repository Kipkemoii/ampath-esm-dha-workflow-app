import React, { useEffect, useState } from 'react';
import styles from './claim-details.modal.scss';
import { type ClaimsVisit } from '../../../types';
import { fetchProviderClaimPreview } from '../../../../../billing-claims.resource';
import { formatDate, parseDate } from '@openmrs/esm-framework';
import ClaimDiagnosisDetails from '../../../../v3/claim-visits/claim-diagnosis-details/claim-diagnosis-details.component';
import ClaimDoctors from '../../../../v3/claim-visits/claim-doctors/claim-doctors';
import ClaimDocuments from '../../../claim-visits/claim-documents/claim-documents';
import ClaimInvoiceDetails from '../../../../v3/claim-visits/claim-invoice-details/claim-invoice-details.component';
import { Modal, ModalBody, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
interface claimDetailsModalProps {
  open: boolean;
  onClose: () => void;
  consentToken: string;
  locationUuid: string;
}
const ClaimDetailsModal: React.FC<claimDetailsModalProps> = ({ open, onClose, consentToken, locationUuid }) => {
  const [claimsVisit, setClaimsVisit] = useState<ClaimsVisit | null>(null);
  useEffect(() => {
    if (locationUuid && consentToken) {
      getClaimProviderPreview();
    }
  }, [locationUuid, consentToken]);
  async function getClaimProviderPreview() {
    const resp = await fetchProviderClaimPreview({
      locationUuid: locationUuid,
      consentToken: consentToken,
    });
    if (resp) {
      setClaimsVisit(resp);
    }
  }
  if (!claimsVisit) {
    return <>No Data to display</>;
  }
  return (
    <>
      <Modal
        modalHeading="Claim Details"
        open={open}
        size="lg"
        onSecondarySubmit={onClose}
        onRequestClose={onClose}
        secondaryButtonText="Close"
      >
        <ModalBody>
          <dl className={styles.detailsGrid}>
            <div className={styles.detailRow}>
              <dt>State</dt>
              <dd>{claimsVisit.workflow_state}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Status</dt>
              <dd>{claimsVisit.claim_auth_status}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Name</dt>
              <dd>{claimsVisit.patient_name}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Member Number</dt>
              <dd>{claimsVisit.member_number}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Scheme Code</dt>
              <dd>{claimsVisit.scheme_code}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Scheme Name</dt>
              <dd>{claimsVisit.scheme_name}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Service Type</dt>
              <dd>{claimsVisit.service_type}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Provider</dt>
              <dd>{claimsVisit.provider_name}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Visit Start</dt>
              <dd>{formatDate(parseDate(claimsVisit.visit_start))}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Total Amount</dt>
              <dd>{claimsVisit.total_claim_amount}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Total Net Amount</dt>
              <dd>{claimsVisit.total_claim_net_amount}</dd>
            </div>
          </dl>

          <div className={styles.cvContentSection}>
            <section className={styles.section}>
              <h6>Invoices</h6>
              <div className={styles.tableScroll}>
                {claimsVisit.invoices && (
                  <ClaimInvoiceDetails
                    claimInvoices={claimsVisit.invoices}
                    consentToken={claimsVisit.authorization_code}
                  />
                )}
              </div>
            </section>
            <section className={styles.section}>
              <h6>Interventions</h6>
              <div className={styles.tableScroll}>
                <Table size="sm">
                  <TableHead>
                    <TableRow>
                      <TableHeader>Code</TableHeader>
                      <TableHeader>Payment Mechanism</TableHeader>
                      <TableHeader>Name</TableHeader>
                      <TableHeader>Accrued Per Diem</TableHeader>
                      <TableHeader>Accrued Per Diem Days</TableHeader>
                      <TableHeader>State</TableHeader>
                      <TableHeader>Sub Benefit Code</TableHeader>
                      <TableHeader>Fund</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {claimsVisit.interventions &&
                      claimsVisit.interventions.map((ci) => {
                        return (
                          <TableRow key={ci.id}>
                            <TableCell>{ci.intervention_code}</TableCell>
                            <TableCell>{ci.intervention_payment_mechanism}</TableCell>
                            <TableCell>{ci.intervention_name}</TableCell>
                            <TableCell>{ci.accrued_per_diem_amount}</TableCell>
                            <TableCell>{ci.accrued_per_diem_days}</TableCell>
                            <TableCell>{ci.workflow_state}</TableCell>
                            <TableCell>{ci.sub_benefit_code}</TableCell>
                            <TableCell>{ci.intervention_fund}</TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </section>
            <section className={styles.section}>
              <h6>Diagnosis</h6>
              <div className={styles.tableScroll}>
                {claimsVisit.claim_diagnoses && <ClaimDiagnosisDetails claimDiagnosiss={claimsVisit.claim_diagnoses} />}
              </div>
            </section>
            <section className={styles.section}>
              <h6>Doctors</h6>
              <div className={styles.tableScroll}>
                <ClaimDoctors claimDoctors={claimsVisit.claim_doctors ?? []} />
              </div>
            </section>
            <section className={styles.section}>
              <h6>Attachments</h6>
              <ClaimDocuments claimAttachments={claimsVisit.claim_attachments ?? []} />
            </section>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};
export default ClaimDetailsModal;
