import React from 'react';
import { type PatientFacilityBillDetails, type VisitIntervention } from '../../types';
import {
  MenuButton,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { launchWorkspace, showSnackbar, useSession } from '@openmrs/esm-framework';

import { invalidatePreauthPreview, parseDocTypes, readSpecialtyFlags } from '../../../v2/preauth/preauth.resource';
import {
  interventionHasBlockingPreauth,
  interventionHasFailedPreauth,
  usePreauthPreview,
} from '../../../../../claims/claims.resource';

interface claimInterventionDetailsProps {
  claimInterventions: VisitIntervention[];
  patientBillDetails: PatientFacilityBillDetails;
  consentToken: string;
  visitUuid: string;
  canSwitchIntervention?: boolean;
  onSwitchSuccess?: () => void;
}

const isActiveIntervention = (iv: VisitIntervention) => (iv.workflow_state ?? '').toUpperCase() === 'ACTIVE';

const ClaimInterventionDetails: React.FC<claimInterventionDetailsProps> = ({
  claimInterventions,
  patientBillDetails,
  consentToken,
  visitUuid,
  canSwitchIntervention = false,
  onSwitchSuccess,
}) => {
  const session = useSession();
  const locationUuid = session?.sessionLocation?.uuid;
  const { preview: preauthPreview } = usePreauthPreview(consentToken, locationUuid);

  if (!claimInterventions || claimInterventions.length === 0) {
    return <>No Intervention data</>;
  }

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
      patientUuid: patientBillDetails?.patient_uuid,
    });
  };

  const canActOnIntervention = (intervention: VisitIntervention) =>
    canSwitchIntervention && isActiveIntervention(intervention);

  const hasBlockingPreauth = (intervention: VisitIntervention) =>
    interventionHasBlockingPreauth(preauthPreview, intervention.intervention_code);

  /** Switch stays locked while a non-resubmittable preauth is in flight / finalised. */
  const canSwitchFor = (intervention: VisitIntervention) =>
    canActOnIntervention(intervention) && !hasBlockingPreauth(intervention);

  const canRaisePreauthFor = (intervention: VisitIntervention) => {
    return canActOnIntervention(intervention) && Boolean(intervention.needs_preauth) && !hasBlockingPreauth(intervention);
  };

  const isResubmitPreauth = (intervention: VisitIntervention) =>
    interventionHasFailedPreauth(preauthPreview, intervention.intervention_code);

  const raisePreauthLabel = (intervention: VisitIntervention) =>
    isResubmitPreauth(intervention) ? 'Resubmit preauth' : 'Raise preauth';

  const handleSwitchIntervention = (intervention: VisitIntervention) => {
    if (!canSwitchFor(intervention)) {
      return;
    }
    launchWorkspace('switch-intervention-workspace', {
      consentToken: consentToken,
      currentInterventions: [intervention],
      patientId: patientBillDetails?.cr_no,
      patientUuid: patientBillDetails?.patient_uuid,
      visitUuid: visitUuid,
      billDate: patientBillDetails?.bill_date,
      onSwitchSuccess: () => {
        onSwitchSuccess?.();
      },
    });
  };
  const handleRaisePreauth = (intervention: VisitIntervention) => {
    if (!canSwitchIntervention) {
      return;
    }
    if (!consentToken) {
      showSnackbar({
        kind: 'error',
        title: 'No claim token',
        subtitle: 'This claim visit has no consent token.',
      });
      return;
    }
    if (!canRaisePreauthFor(intervention)) {
      return;
    }

    const requiredDocs = parseDocTypes(
      Array.isArray(intervention.required_preauth_document_types)
        ? (intervention.required_preauth_document_types as string[]).join(',')
        : (intervention.required_preauth_document_types as string | null | undefined),
    );
    const applicableDocs = Array.isArray(intervention.applicable_document_types)
      ? intervention.applicable_document_types.map(String)
      : parseDocTypes(intervention.applicable_document_types as string | null | undefined);

    // Fresh raise and failure-state resubmit both reopen the same preauth form.
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
        onSwitchSuccess?.();
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
            claimInterventions.map((ci) => {
              const canSwitch = canSwitchFor(ci);
              const canRaise = canRaisePreauthFor(ci);
              const hasAttachments = (ci.applicable_document_types ?? []).length > 0;
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
                  <TableCell>
                    {hasAttachments ? (
                      <MenuButton label="Attachments" kind="ghost" size="sm">
                        <MenuItem label="Generate" onClick={() => handleGenerateAttachment(ci)} />
                        <MenuItem label="Upload" onClick={() => handleAddAttachment(ci)} />
                      </MenuButton>
                    ) : (
                      <Tag type="gray">Not Required</Tag>
                    )}
                  </TableCell>
                  <TableCell>
                    <MenuButton label="Actions" kind="ghost" size="sm">
                      <MenuItem
                        label={raisePreauthLabel(ci)}
                        onClick={() => handleRaisePreauth(ci)}
                        disabled={!canRaise}
                      />
                      <MenuItem
                        label="Switch intervention"
                        onClick={() => handleSwitchIntervention(ci)}
                        disabled={!canSwitch}
                      />
                    </MenuButton>
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </>
  );
};

export default ClaimInterventionDetails;
