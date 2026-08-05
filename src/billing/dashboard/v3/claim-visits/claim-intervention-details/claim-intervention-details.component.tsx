import React from 'react';
import { type PatientFacilityBillDetails, type VisitIntervention } from '../../types';
import { Button, ButtonSet, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@carbon/react';
import { launchWorkspace, showSnackbar, useSession } from '@openmrs/esm-framework';

import styles from './claim-intervention-details.component.scss';
import { invalidatePreauthPreview, parseDocTypes, readSpecialtyFlags } from '../../../v2/preauth/preauth.resource';

interface claimInterventionDetailsProps {
  claimInterventions: VisitIntervention[];
  patientBillDetails: PatientFacilityBillDetails;
  consentToken: string;
  visitUuid: string;
}
const ClaimInterventionDetails: React.FC<claimInterventionDetailsProps> = ({
  claimInterventions,
  patientBillDetails,
  consentToken,
  visitUuid,
}) => {
  if (!claimInterventions || claimInterventions.length === 0) {
    return <>No Intervention data</>;
  }
  function formatPreAuthText(preAuth: boolean) {
    if (preAuth) {
      return 'YES';
    }
    return 'NO';
  }
  const session = useSession();
  const locationUuid = session?.sessionLocation?.uuid;
  const handleAddAttachment = (ci: any) => {
    launchWorkspace('upload-intervention-attachments-workspace', {
      consentToken: consentToken,
      claimInterventions: ci,
      bill: patientBillDetails,
    });
  };

  const handleGenerateAttachment = (ci: any) => {
    launchWorkspace('generate-intervention-attachments-workspace', {
      consentToken: consentToken,
      claimInterventions: ci,
      bill: patientBillDetails,
    });
  };
  const handleSwitchIntervention = (intervention: VisitIntervention) => {
    // if (!canSwitchIntervention) {
    //   return;
    // }
    launchWorkspace('switch-intervention-workspace', {
      consentToken: consentToken,
      currentInterventions: [intervention],
      patientId: patientBillDetails?.cr_no,
      patientUuid: patientBillDetails?.patient_uuid,
      visitUuid: visitUuid,
      billDate: patientBillDetails?.bill_date,
      onSwitchSuccess: () => {
        // invalidateProviderClaimPreview();
      },
    });
  };

  const handleRaisePreauth = (intervention: VisitIntervention) => {
    // if (!canSwitchIntervention) {
    //   return;
    // }
    // const consentToken = claimsVisit.authorization_code;
    if (!consentToken) {
      showSnackbar({
        kind: 'error',
        title: 'No claim token',
        subtitle: 'This claim visit has no consent token.',
      });
      return;
    }
    // if (!intervention.needs_preauth) {
    //   return;
    // }

    const requiredDocs = parseDocTypes(
      Array.isArray(intervention.required_preauth_document_types)
        ? (intervention.required_preauth_document_types as string[]).join(',')
        : (intervention.required_preauth_document_types as string | null | undefined),
    );
    const applicableDocs = Array.isArray(intervention.applicable_document_types)
      ? intervention.applicable_document_types.map(String)
      : parseDocTypes(intervention.applicable_document_types as string | null | undefined);

    launchWorkspace('preauth-form-workspace', {
      consentToken,
      patientUuid: patientBillDetails?.patient_uuid,
      locationUuid,
      billItem: {
        intervention_code: intervention.intervention_code,
        patient_uuid: patientBillDetails?.patient_uuid,
        patient_name: patientBillDetails?.patient_name,
        cr_no: patientBillDetails?.patient_name,
        billable_service: intervention.intervention_name,
        item_price: Number(intervention.keph_level_tarrif) || patientBillDetails?.item_price || 0,
        item_quantity: patientBillDetails?.item_quantity ?? 1,
        consent_token: consentToken,
      },
      intervention: {
        code: intervention.intervention_code,
        name: intervention.intervention_name,
        ...readSpecialtyFlags(intervention),
        requiredPreauthDocumentTypes: requiredDocs,
        applicableDocumentTypes: applicableDocs,
      },
      onSuccess: async () => {
        await invalidatePreauthPreview(consentToken, locationUuid!);
        // invalidateProviderClaimPreview();
      },
    });
  };
  return (
    <>
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
            <TableHeader>Attachments</TableHeader>
            <TableHeader>Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {claimInterventions &&
            claimInterventions.map((ci, index) => {
              return (
                <>
                  <TableRow key={ci.id}>
                    <TableCell>{ci.intervention_code}</TableCell>
                    <TableCell>{ci.intervention_payment_mechanism}</TableCell>
                    <TableCell>{ci.intervention_name}</TableCell>
                    <TableCell>{ci.accrued_per_diem_amount}</TableCell>
                    <TableCell>{ci.accrued_per_diem_days}</TableCell>
                    <TableCell>{ci.workflow_state}</TableCell>
                    <TableCell>{ci.sub_benefit_code}</TableCell>
                    <TableCell>{ci.intervention_fund}</TableCell>
                    <TableCell>
                      {ci.applicable_document_types.length > 0 ? (
                        <div className={styles.attachmentButtons}>
                          <Button kind="primary" size="sm" onClick={() => handleGenerateAttachment(ci)}>
                            Generate
                          </Button>

                          <Button kind="primary" size="sm" onClick={() => handleAddAttachment(ci)}>
                            Upload
                          </Button>
                        </div>
                      ) : (
                        <Tag type="gray">Not Required</Tag>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className={styles.attachmentButtons}>
                        <Button
                          size="sm"
                          onClick={() => {
                            handleRaisePreauth(ci);
                          }}
                        >
                          Raise preauth
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            handleSwitchIntervention(ci);
                          }}
                        >
                          Switch intervention
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </>
              );
            })}
        </TableBody>
      </Table>
    </>
  );
};

export default ClaimInterventionDetails;
