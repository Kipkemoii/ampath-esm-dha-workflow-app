import { Modal, ModalBody, Select, SelectItem } from "@carbon/react";
import React, { useState } from "react";
import { AssignBedToPatientDto, BedLayout, BedSwapDto, Disposition } from "../../types";
import styles from './bed-swap.modal.scss';
import { AdmissionEncounterTypeUuids } from "../../constants";
import { Encounter,Person, showSnackbar, useSession } from "@openmrs/esm-framework";
import { assignBedToPatient, bedSwapRequest } from "../../admissions.resource";
interface BedSwapModalProps {
    open: boolean;
    disposition: Disposition;
    person: Person;
    onModalClose: () => void;
    bedLayouts: BedLayout[];
    onSuccessfullBedSwap: () => void;
}
const BedSwapModal: React.FC<BedSwapModalProps> = ({open,onModalClose,onSuccessfullBedSwap,bedLayouts,disposition,person})=>{
    const [selectedBedId, setSelectedBedId] = useState<number>();
    const session = useSession();
    const location = session.sessionLocation;
    
    const swapBed = async ()=>{

        try{
            const bedSwapPayload = generateBedSwapRequestDto();
            const resp = await bedSwapRequest(bedSwapPayload);

              //assign bed to patient
            const assignBedDto = generateAssignBedPayload(resp);
            await assignBedToPatient(selectedBedId,assignBedDto);
            showSnackbar({
                kind: 'success',
                title: 'Bed swap Successfull',
                subtitle: `Patient Successfully assigned bed ${selectedBedId}`,
            });
            onSuccessfullBedSwap();
        }catch(error){
            console.log({error});
            showSnackbar({
                kind: 'error',
                title: 'Bed Assignment failed',
                subtitle: error.message ?? 'Bed Assignment failed'
            });
        }
      

    }
    const generateAssignBedPayload = (assignEncounter: Encounter): AssignBedToPatientDto=>{
        return {
            patientUuid: person.uuid,
            encounterUuid: assignEncounter.uuid
        }
    }
    const handleBedChange = (bedId: number)=>{
        setSelectedBedId(bedId);
    }
    const generateBedSwapRequestDto = (): BedSwapDto => {
        return {
            "patient": person.uuid,
            "encounterType": {
                "uuid": AdmissionEncounterTypeUuids.BED_ASSIGNMENT_ENCOUNTER_TYPE_UUID,
            },
            "location": location.uuid,
            "obs": [],
        }
    }

    return <>
     <Modal
            modalHeading="Swap Beds"
            open={open}
            size="md"
            onSecondarySubmit={() => onModalClose()}
            onRequestClose={() => onModalClose()}
            onRequestSubmit={swapBed}
            primaryButtonText="Swap Beds"
            secondaryButtonText="Cancel"
        >
            <ModalBody>
                <div className={styles.serveModalLayout}>
                    <div className={styles.serveModalContentSection}>
                        <div className={styles.formRow}>
                            <Select
                                id="ward-beds"
                                labelText="Beds"
                                onChange={($event) => handleBedChange(parseInt($event.target.value))}
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
export default BedSwapModal;