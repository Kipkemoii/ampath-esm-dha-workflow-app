import React, { useState } from "react";
import styles from './visit-diagnosis-details.component.scss';
import { type AmrsVisitDiagnosis } from "../../../../types";
import { Button, OverflowMenu, OverflowMenuItem, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from "@carbon/react";
import { formatDate, parseDate } from "@openmrs/esm-framework";
import AddClaimDiagnosisModal from "../modals/add-claim-diagnosis/add-claim-diagnosis.modal";
import { useInvalidateProviderClaimPreview } from "../../../../billing-claims.resource";
import { ClaimsVisit } from "../../types";

interface visitDiagnosisDetailsProps {
  amrsVisitDiagnosis: AmrsVisitDiagnosis[];
  consentToken: string;
  interventionCode: string;
  locationUuid: string;
  claimsVisit: ClaimsVisit;
}
const VisitDiagnosisDetails: React.FC<visitDiagnosisDetailsProps> = ({ amrsVisitDiagnosis, consentToken, interventionCode, locationUuid, claimsVisit }) => {
  const [selectedAmrsDiagnosis, setSelectedAmrsDiagnosis] = useState<AmrsVisitDiagnosis | null>(null);
  const [showAddClaimDiagnosisModal, setShowAddClaimDiagnosisModal] = useState<boolean>(false);
  const invalidateProviderClaimPreview = useInvalidateProviderClaimPreview();

  function handleCloseModal() {
    setShowAddClaimDiagnosisModal(false);
  }
  function handleDiagnosisSelection(amrsVisitDiagnosis: AmrsVisitDiagnosis) {
    setSelectedAmrsDiagnosis(amrsVisitDiagnosis);
    setShowAddClaimDiagnosisModal(true);
  }
  function onSuccess() {
    handleCloseModal();
    invalidateProviderClaimPreview();
  }
  const diagnosisAddedToClaim = (d: AmrsVisitDiagnosis): boolean => {
    // Check if diagnosis is already added to the claim
    if (!claimsVisit?.claim_diagnoses) return false;
    return claimsVisit.claim_diagnoses.some(
      (cd) => cd.diagnosis_code === d.icd11_code
    );
  };
  return <>
    <div>
      <Table aria-label="diagnoses" size="sm">
        <TableHead>
          <TableRow>
            <TableHeader>No</TableHeader>
            <TableHeader>Encounter Date</TableHeader>
            <TableHeader>Encounter Type</TableHeader>
            <TableHeader>ICD11 Diagnosis</TableHeader>
            <TableHeader>Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {amrsVisitDiagnosis &&
            amrsVisitDiagnosis.map((d, index) => {
              return (
                <>
                  <TableRow key={d.encounter_id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{formatDate(parseDate(d.encounter_datetime))}</TableCell>
                    <TableCell>{d.encounter_type}</TableCell>
                    <TableCell>{d.icd11_code}</TableCell>
                    <TableCell>
                      {claimsVisit && claimsVisit.workflow_state === 'DRAFT' && !diagnosisAddedToClaim(d) && (
                        <Button size="sm" kind="tertiary" onClick={() => handleDiagnosisSelection(d)}>Add Claim Diagnosis</Button>
                      )}
                      {claimsVisit && claimsVisit.workflow_state !== 'DRAFT' && (
                        <Tag>{claimsVisit.workflow_state}</Tag>
                      )}
                    </TableCell>
                  </TableRow>
                </>
              );
            })}
        </TableBody>
      </Table>

      {
        (showAddClaimDiagnosisModal && selectedAmrsDiagnosis) &&
        <AddClaimDiagnosisModal
          consentToken={consentToken}
          amrsVisitDiagnosis={selectedAmrsDiagnosis}
          locationUuid={locationUuid}
          interventionCode={interventionCode}
          open={showAddClaimDiagnosisModal}
          onClose={handleCloseModal}
          onSuccess={onSuccess}
        />
      }
    </div>
  </>
}
export default VisitDiagnosisDetails;