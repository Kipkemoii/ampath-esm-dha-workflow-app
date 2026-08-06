import React from 'react';
import { type DischargePatientDto, type Disposition, type UnAssignBedDto } from '../../types';
import { Modal, ModalBody } from '@carbon/react';
import styles from './discharge-patient.modal.scss';
import { AdmissionEncounterTypeUuids } from '../../constants';
import { type Person, showSnackbar, useSession } from '@openmrs/esm-framework';
import { dischargePatientFromWard, unassignBed } from '../../admissions.resource';
interface DischargeModalProps {
  open: boolean;
  bedId: number;
  patientUuid: string;
  locationUuid: string;
  onModalClose: () => void;
  onDischarge: () => void;
}
const DischargeModal: React.FC<DischargeModalProps> = ({ open, bedId, patientUuid, locationUuid, onModalClose, onDischarge }) => {
  const session = useSession();
  const location = session.sessionLocation;
  const handleDischarge = async () => {
    try {
      const dischargeDto = generateDischargePatientRequestDto();
      await dischargePatientFromWard(dischargeDto);
      showSnackbar({
        kind: 'success',
        title: 'Discharge request successfull',
        subtitle: 'Patient Succesfully discharged from ward',
      });

      // unassign bed
      const unAssignBedDto = generateUnassignBedDto();
      await unassignBed(unAssignBedDto);

      showSnackbar({
        kind: 'success',
        title: 'Bed Unassigned successfull',
        subtitle: `Bed ${bedId} successfully unassigned`,
      });
      onDischarge();
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Patient Discharge failed',
        subtitle: 'Patient Discharge failed',
      });
    }
  };
  const generateDischargePatientRequestDto = (): DischargePatientDto => {
    return {
      patient: patientUuid,
      encounterType: {
        uuid: AdmissionEncounterTypeUuids.DISCHARGE_ENCOUNTER_TYPE_UUID,
      },
      location: locationUuid,
      obs: [],
    };
  };
  const generateUnassignBedDto = (): UnAssignBedDto => {
    return {
      patientUuid: patientUuid,
      bedId: bedId,
    };
  };
  return (
    <>
      <Modal
        modalHeading="Discharge"
        open={open}
        size="md"
        onSecondarySubmit={onModalClose}
        onRequestClose={onModalClose}
        onRequestSubmit={handleDischarge}
        primaryButtonText="Discharge"
        secondaryButtonText="Cancel"
      >
        <ModalBody>
          <div className={styles.dischargeLayout}>
            <div className={styles.contentSection}>
              <h5>Are you sure you want to discharge Patient from Ward?</h5>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};
export default DischargeModal;
