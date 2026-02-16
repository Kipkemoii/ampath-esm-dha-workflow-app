import React, { useRef } from "react"
import styles from './cancel-admission-request.scss';
import { Button, Modal, ModalBody, TextArea } from "@carbon/react";
import { CancelAdmissionDto, Disposition } from "../../types";
import { showSnackbar, useSession } from "@openmrs/esm-framework";
import { AdmissionConcepts, AdmissionEncounterTypeUuids } from "../../constants";
import { cancelAdmissionRequest } from "../../admissions.resource";

interface CancelAdmissionRequestModalProps {
    open: boolean;
    admissionRequest: Disposition;
    onModalClose: () => void;
    onCancelAdmission: () => void;
}
const CancelAdmissionRequestModal: React.FC<CancelAdmissionRequestModalProps> = ({ open, admissionRequest, onCancelAdmission, onModalClose }) => {
    const reasonRef = useRef<string>();
    const session = useSession();
    const location = session.sessionLocation;
    const handleReasonText = (reason: string) => {
        reasonRef.current = reason;
    };
    const handleCancelRequest = async () => {
        try {
            const cancelAdmissionDto = generateCancelAdmissionRequestDto();
            const resp = await cancelAdmissionRequest(cancelAdmissionDto);
            if (resp) {
                showSnackbar({
                    kind: 'success',
                    title: 'Cancel request successfull',
                    subtitle: 'Admission request succesfully cancelled',
                });
            }
            onCancelAdmission();

        } catch (error) {

            showSnackbar({
                kind: 'error',
                title: 'Bed Assignment failed',
                subtitle: error.message ?? 'Bed Assignment failed'
            });

        }


    };
    const generateCancelAdmissionRequestDto = (): CancelAdmissionDto => {
        return {
            "patient": admissionRequest.patient.uuid,
            "encounterType": {
                "uuid": AdmissionEncounterTypeUuids.CANCEL_ADT_ENCOUNTER_TYPE_UUID,
            },
            "location": location.uuid,
            "obs": [
                {
                    "concept": AdmissionConcepts.CLINICAL_NOTES_UUID,
                    "value": reasonRef.current
                },
                {
                    "concept": AdmissionConcepts.ADMISSION_TO_HOSPITAL_DECISION_UUID,
                    "value": {
                        "uuid": AdmissionConcepts.ADMISSION_DENIED_UUID
                    }
                }
            ],
            "visit": admissionRequest.visit.uuid
        }
    }

    return <>
        <Modal
            modalHeading="Cancel Admission Request"
            open={open}
            size="md"
            onSecondarySubmit={onModalClose}
            onRequestClose={onModalClose}
            onRequestSubmit={handleCancelRequest}
            primaryButtonText="Cancel Admission Request"
            secondaryButtonText="Cancel"
        >
            <ModalBody>
                <div className={styles.cancelAdmissionLayout}>
                    <div className={styles.contentSection}>
                        <div className={styles.formRow}>
                            <TextArea
                                enableCounter
                                helperText=""
                                id="cancel-reason"
                                labelText="Cancel Reason"
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

export default CancelAdmissionRequestModal;