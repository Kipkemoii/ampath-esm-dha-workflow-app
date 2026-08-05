import React, { useEffect, useMemo, useState } from 'react';
import styles from './claim-visit-details.component.scss';
import { type PatientFacilityBillDetails, type ClaimsVisit, ApplicableDocumentType } from '../../types';
import ClaimInvoiceDetails from '../claim-invoice-details/claim-invoice-details.component';
import ClaimInterventionDetails from '../claim-intervention-details/claim-intervention-details.component';
import ClaimDiagnosisDetails from '../claim-diagnosis-details/claim-diagnosis-details.component';
import { formatDate, launchWorkspace, parseDate, showSnackbar, useVisit } from '@openmrs/esm-framework';
import { Button, InlineLoading, Tile } from '@carbon/react';
import CloseClaimModal from '../modal/close-claim/close-claim.modal';
import SubmitClaimModal from '../modal/submit-claim/submit-claim.modal';
import { endVisit, useInvalidateProviderClaimPreview, usePayerClaimPreview } from '../../../../billing-claims.resource';
import ClaimDocuments from '../claim-documents/claim-documents';
import ClaimDoctors from '../claim-doctors/claim-doctors';
import AddClaimDoctorModal from '../modal/claim-doctors/add-claim-doctor/add-claim-doctor.modal';
import { VisitTypeUuids } from '../../../../../shared/constants/visit-types';
import { VisitType } from '../../../../../claims';
import { canEditClaimContent } from '../../../v2/claim-statuses';
import { interventionHasBlockingPreauth, usePreauthPreview } from '../../../../../claims/claims.resource';
import PayerPreviewTile from '../payer-preview/payer-preview-tile.component';

interface claimVisitDetailsProps {
  claimsVisit: ClaimsVisit;
  locationUuid: string;
  patientBillDetails?: PatientFacilityBillDetails;
  onBillDetailsChange?: () => void;
  /** True while claim preview is revalidating — stand down content edits. */
  claimRefreshing?: boolean;
}
const ClaimVisitDetails: React.FC<claimVisitDetailsProps> = ({
  claimsVisit,
  locationUuid,
  patientBillDetails,
  onBillDetailsChange,
  claimRefreshing = false,
}) => {
  const [showCloseClaimModal, setShowCloseClaimModal] = useState<boolean>();
  const [showSubmitClaimModal, setSubmitCloseClaimModal] = useState<boolean>(false);
  const [showAddDoctorModal, setShowAddDoctorModal] = useState<boolean>(false);
  const [triggerEndVisit, setTriggerEndVisit] = useState<boolean>(false);
  const { activeVisit } = useVisit(patientBillDetails?.patient_uuid);

  const invoiceNumber = useMemo(() => {
    if (patientBillDetails) {
      return patientBillDetails.receipt_number;
    }
    return '';
  }, [patientBillDetails]);

  const { isLoading: isLoadingPayerPreview, payerPreviewResult } = usePayerClaimPreview(invoiceNumber, locationUuid);

  useEffect(() => {
    if (triggerEndVisit && activeVisit) {
      handleCloseVisit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerEndVisit, activeVisit]);

  function handleCloseVisit() {
    endVisit(activeVisit?.uuid)
      .then((v) => {
        showSnackbar({
          title: 'Success closing claim',
          kind: 'success',
          subtitle: 'Claim closed successfully',
        });
      })
      .catch((err) => {
        console.error(err);
      });
  }

  const visitType: VisitType = useMemo(() => {
    if (activeVisit) {
      const visitTypeUuid = activeVisit?.visitType?.uuid;
      if (visitTypeUuid) {
        if (visitTypeUuid === VisitTypeUuids.OPD_VISIT_TYPE_UUID) {
          return 'OUTPATIENT';
        }
        if (visitTypeUuid === VisitTypeUuids.INPATIENT_VISIT_TYPE_UUID) {
          return 'INPATIENT';
        }
      }
    }
    return 'OUTPATIENT';
  }, [activeVisit, VisitTypeUuids]);

  const invalidateProviderClaimPreview = useInvalidateProviderClaimPreview();
  const { preview: preauthPreview } = usePreauthPreview(claimsVisit?.authorization_code, locationUuid);

  if (!claimsVisit) {
    return <>No Data</>;
  }

  function displayCloseClaimModal() {
    setShowCloseClaimModal(true);
  }
  function handleCloseClaimModal() {
    setShowCloseClaimModal(false);
  }
  function displayCloseSubmitClaimModal() {
    setSubmitCloseClaimModal(true);
  }
  function handleCloseSubmitClaimModal() {
    setSubmitCloseClaimModal(false);
  }
  function onSubmitSuccess() {
    setTriggerEndVisit(true);
    handleCloseSubmitClaimModal();
    invalidateProviderClaimPreview();
  }
  function onCloseSuccess() {
    handleCloseClaimModal();
    invalidateProviderClaimPreview();
  }
  function handleAddDoctor() {
    setShowAddDoctorModal(true);
  }
  function handleCloseAddDoctorModal() {
    setShowAddDoctorModal(false);
  }

  const handleAddAttachment = () => {
    launchWorkspace('upload-intervention-attachments-workspace', {
      consentToken: claimsVisit.authorization_code,
      patientUuid: '10',
      claimInterventions: claimsVisit.interventions,
      bill: patientBillDetails,
    });
  };

  const handleGenerateAttachment = () => {
    launchWorkspace('generate-intervention-attachments-workspace', {
      consentToken: claimsVisit.authorization_code,
      patientUuid: '10',
      claimInterventions: claimsVisit.interventions,
      bill: patientBillDetails,
    });
  };

  // Same gates as v2: content edits only while claim is DRAFT / DRAFT_RESUBMIT and not refreshing.
  const canSwitchIntervention = canEditClaimContent(claimsVisit.workflow_state) && !claimRefreshing;
  const hasSwitchableIntervention = Boolean(
    claimsVisit.interventions?.some((iv) => {
      const active = (iv.workflow_state ?? '').toUpperCase() === 'ACTIVE';
      if (!active) return false;
      // Match row Actions: blocking preauth locks Switch together with Raise/Resubmit.
      return !interventionHasBlockingPreauth(preauthPreview, iv.intervention_code);
    }),
  );

  const canEditClaim = canEditClaimContent(claimsVisit.workflow_state) && !claimRefreshing;

  const handleSwitchIntervention = () => {
    if (!canSwitchIntervention || !hasSwitchableIntervention) {
      return;
    }
    launchWorkspace('switch-intervention-workspace', {
      consentToken: claimsVisit.authorization_code,
      currentInterventions: claimsVisit.interventions,
      patientId: patientBillDetails?.cr_no ?? claimsVisit.patient_number,
      patientUuid: patientBillDetails?.patient_uuid,
      visitUuid: activeVisit?.uuid,
      billDate: patientBillDetails?.bill_date ?? claimsVisit.visit_start,
      onSwitchSuccess: () => {
        invalidateProviderClaimPreview();
        onBillDetailsChange?.();
      },
    });
  };

  return (
    <>
      <div className={styles.cvLayout}>
        <div className={styles.cvHeaderSection}>
          <div className={styles.headerTitle}>
            <h4>Claim Visit Details</h4>
          </div>
          <div className={styles.headerAction}>
            <Button
              kind="primary"
              onClick={displayCloseClaimModal}
              disabled={!canEditClaim}>
              Close Claim
            </Button>
            <Button
              kind="tertiary"
              onClick={displayCloseSubmitClaimModal}
              disabled={!canEditClaim}>
              Submit claim
            </Button>
            <Button
              kind="tertiary"
              onClick={handleSwitchIntervention}
              disabled={!canSwitchIntervention || !hasSwitchableIntervention}
            >
              Switch Intervention
            </Button>
          </div>
        </div>

        <Tile
          id="provider-preview"
        >
          <dd>Provider preview</dd>
          <br />
          <br />
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
        </Tile>

        {
          !isLoadingPayerPreview && payerPreviewResult &&
          <PayerPreviewTile isLoadingPayerPreview={isLoadingPayerPreview} payerPreviewResult={payerPreviewResult} />
        }

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
              {claimsVisit.interventions && (
                <ClaimInterventionDetails
                  patientBillDetails={patientBillDetails}
                  claimInterventions={claimsVisit.interventions}
                  consentToken={claimsVisit.authorization_code}
                  visitUuid={activeVisit?.uuid}
                  canSwitchIntervention={canSwitchIntervention}
                  onSwitchSuccess={() => {
                    invalidateProviderClaimPreview();
                    onBillDetailsChange?.();
                  }}
                />
              )}
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
      </div>
      {showCloseClaimModal && (
        <CloseClaimModal
          locationUuid={locationUuid}
          open={showCloseClaimModal}
          onClose={handleCloseClaimModal}
          onSuccess={onCloseSuccess}
          consentToken={claimsVisit.authorization_code}
        />
      )}
      {showSubmitClaimModal && (
        <SubmitClaimModal
          locationUuid={locationUuid}
          open={showSubmitClaimModal}
          onClose={handleCloseSubmitClaimModal}
          onSuccess={onSubmitSuccess}
          claimsVisit={claimsVisit}
          invoiceNumber={invoiceNumber}
          visitType={visitType}
        />
      )}
      {showAddDoctorModal && (
        <AddClaimDoctorModal
          open={showAddDoctorModal}
          handleClose={handleCloseAddDoctorModal}
          claimDoctors={[]}
          consentToken={claimsVisit.authorization_code}
        />
      )}
    </>
  );
};
export default ClaimVisitDetails;
