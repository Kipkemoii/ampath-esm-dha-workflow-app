import React from "react"
import { DischargePatientDto, Disposition, UnAssignBedDto } from "../../types";
import { Modal, ModalBody } from "@carbon/react";
import styles from './discharge-patient.modal.scss';
import { AdmissionEncounterTypeUuids } from "../../constants";
import { Person, showSnackbar, useSession } from "@openmrs/esm-framework";
import { dischargePatientFromWard, unassignBed } from "../../admissions.resource";
interface DischargeModalProps {
    open: boolean;
    admissionRequest: Disposition & {bedId: number; person: Person};
    onModalClose: () => void;
    onDischarge: () => void;
}
const DischargeModal: React.FC<DischargeModalProps> = ({ open, admissionRequest, onModalClose, onDischarge}) => {
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
                subtitle: `Bed ${admissionRequest.bedId} successfully unassigned`,
            });
            onDischarge();

        } catch (error) {
            debugger;
            showSnackbar({
                kind: 'error',
                title: 'Patient Discharge failed',
                subtitle: 'Patient Discharge failed',
            });
        }
    }
    const generateDischargePatientRequestDto = (): DischargePatientDto => {
        return {
            "patient": admissionRequest.person.uuid,
            "encounterType": {
                "uuid": AdmissionEncounterTypeUuids.DISCHARGE_ENCOUNTER_TYPE_UUID,
            },
            "location": location.uuid,
            "obs": [],
        }
    }
    const generateUnassignBedDto = (): UnAssignBedDto => {
        return {
            patientUuid: admissionRequest.person.uuid,
            bedId: admissionRequest.bedId
        }
    }
    return <>
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
}
export default DischargeModal;