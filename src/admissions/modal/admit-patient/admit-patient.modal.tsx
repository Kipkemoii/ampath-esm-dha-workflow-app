import React, { useState } from "react";
import { AdmitPatientDto, AssignBedToPatientDto, BedLayout, Disposition } from "../../types";
import { Modal, ModalBody, Select, SelectItem } from "@carbon/react";
import { Encounter, Patient, showSnackbar, useSession } from "@openmrs/esm-framework";
import styles from './admit-patient.modal.scss';
import { AdmissionEncounterTypeUuids } from "../../constants";
import { admitPatientToWard, assignBedToPatient } from "../../admissions.resource";
interface AdmitPatientModalProps {
    open: boolean;
    disposition: Disposition;
    onModalClose: () => void;
    bedLayouts: BedLayout[];
    onSuccessfullAdmission: () => void;
}
const AdmitPatientModal: React.FC<AdmitPatientModalProps> = ({ onModalClose, open, disposition, bedLayouts, onSuccessfullAdmission }) => {
    const [selectedBedId, setSelectedBedId] = useState<number>();
    const session = useSession();
    const location = session.sessionLocation;

    const admitPatient = async () => {
        try{
            const admitPatientDto = generateAdmitPatientPayload();
            const resp = await admitPatientToWard(admitPatientDto);

            showSnackbar({
                kind: 'success',
                title: 'Admission Successfull',
                subtitle: 'Patient Successfully Admitted',
            });
    
            //assign bed to patient
            const assignBedDto = generateAssignBedPayload(resp);
            await assignBedToPatient(selectedBedId,assignBedDto);

            showSnackbar({
                kind: 'success',
                title: 'Bed Assignment Successfull',
                subtitle: `Patient Successfully assigned bed ${selectedBedId}`,
            });

            onSuccessfullAdmission();
            
        }catch(error){
            console.log({error});
            showSnackbar({
                kind: 'error',
                title: 'Bed Assignment failed',
                subtitle: error.message ?? 'Bed Assignment failed'
            });

        }
       
    };
    const bedSelectedHandler = (bedId: number) => {
        setSelectedBedId(bedId);
    };
    const generateAdmitPatientPayload = (): AdmitPatientDto=>{
      return {
        patient: disposition.patient.uuid,
        encounterType: {
            uuid: AdmissionEncounterTypeUuids.ADMIT_ENCOUNTER_TYPE_UUID
        },
        location: location.uuid,
        obs: [],
        visit: disposition.visit.uuid
      }
    }
    const generateAssignBedPayload = (admissionEncounter: Encounter): AssignBedToPatientDto=>{
        return {
            patientUuid: disposition.patient.uuid,
            encounterUuid: admissionEncounter.uuid
        }
    }
    return <>
        <Modal
            modalHeading="Admit Patient"
            open={open}
            size="md"
            onSecondarySubmit={() => onModalClose()}
            onRequestClose={() => onModalClose()}
            onRequestSubmit={admitPatient}
            primaryButtonText="Admit"
            secondaryButtonText="Cancel"
        >
            <ModalBody>
                <div className={styles.serveModalLayout}>
                    <div className={styles.serveModalContentSection}>
                        <div className={styles.formRow}>
                            <Select
                                id="ward-beds"
                                labelText="Beds"
                                onChange={($event) => bedSelectedHandler(parseInt($event.target.value))}
                            >
                                <SelectItem value="" text="Select" />;
                                {bedLayouts &&
                                    bedLayouts.filter((bl)=>{
                                        return bl.status === 'AVAILABLE'
                                    }).map((bl) => {
                                        return <SelectItem value={bl.bedId} text={`${bl.bedNumber} (${bl.status})`} />;
                                    })}
                            </Select>
                        </div>
                    </div>
                </div>
            </ModalBody>
        </Modal>
    </>
}
export default AdmitPatientModal;