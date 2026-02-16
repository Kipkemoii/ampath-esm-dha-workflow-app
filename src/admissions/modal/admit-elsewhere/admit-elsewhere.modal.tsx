import { ComboBox, Modal, ModalBody, Select, SelectItem, TextArea } from "@carbon/react";
import React, { useMemo, useRef, useState } from "react";
import styles from './admit-elsewhere.modal.scss'
import { Location, Patient, showSnackbar, useLocations, useSession, Visit } from "@openmrs/esm-framework";
import { AdmitPatientDto } from "../../types";
import { AdmissionConcepts, AdmissionEncounterTypeUuids } from "../../constants";
import { admitPatientElseWhere } from "../../admissions.resource";
interface AdmitElsewhereModalProps {
    open: boolean;
    patient: Patient;
    visit: Visit;
    onModalClose: () => void;
    onSuccessfullTransfer: () => void;
}
const AdmitElsewhereModal: React.FC<AdmitElsewhereModalProps> = ({ open, onModalClose, onSuccessfullTransfer, patient, visit }) => {
    const [transferLocation, setTransferLocation] = useState<string>();
    const locations = useLocations();
    const session = useSession();
    const userLocation = session.sessionLocation;
    const reasonRef = useRef<string>();
    const locationsOptions = useMemo(() => generateLocationOption(), [locations]);
    function generateLocationOption() {
        return locations.filter((l)=>{
            if(!userLocation){
             return true;
            }else{
                return l.uuid !== userLocation.uuid;
            }
        }).map((l: Location) => {
            return {
                id: l.uuid,
                text: l.display,
            };
        });
    }
    const handleTransfer = async () => {
        if(!validateTransferPayload()){
            return;
        }
        try {
            const transferPatientDto = generateAdmitPatientPayload();
            await admitPatientElseWhere(transferPatientDto);
            showSnackbar({
                kind: 'success',
                title: 'Transfer Request Successful',
                subtitle: 'Patient Transfer Request was Successful',
            });
            onSuccessfullTransfer();
        } catch (error) {
            console.log({ error });
            showSnackbar({
                kind: 'error',
                title: 'Transfer Request failed',
                subtitle: error.message ?? 'Patient Transfer Request failed'
            });
        }

    };
    const validateTransferPayload = ():boolean=>{
     if(!transferLocation){
        showSnackbar({
            kind: 'error',
            title: 'Transfer Location missing',
            subtitle: 'Please select the location to transfer patient'
        });
        return false;
     }
     if(!reasonRef.current){
        showSnackbar({
            kind: 'error',
            title: 'Missing Transfer reason',
            subtitle: 'Please enter the transfer reason'
        });
        return false;
     }
     return true;
    };
    const generateAdmitPatientPayload = (): AdmitPatientDto => {
        return {
            patient: patient.uuid,
            encounterType: {
                uuid: AdmissionEncounterTypeUuids.TRANSFER_REQUEST_ENCOUNTER_TYPE_UUID
            },
            location: userLocation.uuid,
            obs: [
                {
                    "concept": AdmissionConcepts.INPATIENT_DISPOSITION_CONSTRUCT_UUID,
                    "groupMembers": [
                        {
                            "concept": AdmissionConcepts.INTERNAL_TRANSFER_LOCATION_UUID,
                            "value": transferLocation
                        },
                        {
                            "concept": AdmissionConcepts.INPATIENT_PATIENT_DISPOSITION_UUID,
                            "value": AdmissionConcepts.TRANSFER_OUT_UUID
                        },
                        {
                            "concept": AdmissionConcepts.CLINICAL_NOTES_UUID,
                            "value": reasonRef.current
                        }
                    ]
                }
            ],
            visit: visit.uuid
        }
    }
    const handleReasonText = (reason: string) => {
        reasonRef.current = reason;
    };
    const locationChangeHandler = (location: { selectedItem: { id: string; text: string } }) => {
        const l = location.selectedItem.id;
        setTransferLocation(l);
    };
    return <>
        <Modal
            modalHeading="Transfer Elsewhere"
            open={open}
            size="md"
            onSecondarySubmit={() => onModalClose()}
            onRequestClose={() => onModalClose()}
            onRequestSubmit={handleTransfer}
            primaryButtonText="Send Admission Request"
            secondaryButtonText="Cancel"
        >
            <ModalBody>
                <div className={styles.admitModalLayout}>
                    <div className={styles.admitModalContentSection}>
                        <div className={styles.formRow}>
                            <ComboBox
                                onChange={locationChangeHandler}
                                id="visit-type-combobox"
                                items={locationsOptions}
                                itemToString={(item) => (item ? item.text : '')}
                                titleText="Select Transfer Location"
                                className={styles.locationSelect}
                            />
                        </div>
                        <div className={styles.formRow}>
                            <TextArea
                                enableCounter
                                helperText=""
                                id="transfer-reason"
                                labelText="Transfer Reason"
                                maxCount={500}
                                placeholder=""
                                rows={4}
                                onChange={(e) => handleReasonText(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </ModalBody>
        </Modal>
    </>
}
export default AdmitElsewhereModal;