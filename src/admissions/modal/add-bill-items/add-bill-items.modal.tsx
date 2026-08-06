import React, { useEffect, useState } from "react";
import { Button, ComboBox, Modal, ModalBody } from "@carbon/react";
import styles from './add-bill-items.modal.scss';
import { fetchBillableServices } from "../../../shared/services/billing.resource";
import { type ServicePrice, type BillableService } from "../../../shared/types";

interface addBillItemsModalProps {
    crId: string;
    patientUuid: string;
    onModalClose: ()=>void;
    onAddBillItems: ()=>void;
    open: boolean;
}
const AddBillItemsModal: React.FC<addBillItemsModalProps> = ({crId,patientUuid,onModalClose,onAddBillItems,open})=>{
const [billItems,setBillItems] = useState();
const [billableServices, setBillableServices] = useState<BillableService[]>([]);
const [servicePrices, setServicePrices] = useState<ServicePrice[]>([]);
const [selectedBillableService,setSelectedBillableService] = useState<BillableService | null>();
const [selectedServicePrice,setSelectedServicePrice] = useState<ServicePrice | null>();
const [billableItems,setBillableItems] = useState<any[]>([]);
useEffect(()=>{
     getBillableServices();
},[]);
function addBillItem(){
    const newBillableItems = [
        ...billableItems,
        {
            billablePrice: selectedServicePrice,
            servicePrice: selectedServicePrice
        }
    ];
    setBillableItems(newBillableItems);
    setSelectedBillableService(null);
    setSelectedServicePrice(null);

}

async function getBillableServices() {
    const billableServices = await fetchBillableServices();
    setBillableServices(billableServices);
    generateServiceTypesList(billableServices);
  }

  function handleSelectBillableService(selectedBillService: BillableService){
       setSelectedBillableService(selectedBillService)
  }
  function handleSelectBillableServicePrice(servicePrice: ServicePrice){
      setSelectedServicePrice(servicePrice);
  }

  function generateServiceTypesList(billableServices: BillableService[]) {
    const sp: ServicePrice[] = [];
    for (let bs of billableServices) {
      if (bs.servicePrices) {
        const servicePrices = bs.servicePrices;
        for (let servicePrice of servicePrices) {
          sp.push(servicePrice);
        }
      }
    }
    setServicePrices(sp);
  }
return <>
        <Modal
            modalHeading="Admit Patient"
            open={open}
            size="lg"
            onSecondarySubmit={() => onModalClose()}
            onRequestClose={() => onModalClose()}
            onRequestSubmit={onAddBillItems}
            primaryButtonText="Add Charge Items"
            secondaryButtonText="Cancel"
        >
            <ModalBody>
                <div className={styles.addBillItemsModalLayout}>
                    <div className={styles.addBillItemsModalContentSection}>
                        <div className={styles.formRow}>
                            <div className={styles.inputWidth}>
                                <ComboBox
                                    id="billable-service"
                                    titleText="Billable Services"
                                    placeholder="Search Billable service"
                                    items={billableServices ?? []}
                                    itemToString={(item) => item?.name ?? ''}
                                    onChange={({ selectedItem }) => handleSelectBillableService(selectedItem)}
                                    />
                            </div>
                            <div className={styles.inputWidth}>
                                <ComboBox
                                    id="billable-service-price"
                                    titleText="Price"
                                    placeholder="Search Billable service"
                                    items={selectedBillableService?.servicePrices ?? []}
                                    itemToString={(item) => {
                                        return `${item?.name}- KES ${item?.price}`
                                    }}
                                    onChange={({ selectedItem }) => handleSelectBillableServicePrice(selectedItem)}
                                    />
                            </div>
                            <div className={styles.inputWidth}>
                                 <Button onClick={addBillItem}>Add Items</Button>
                            </div>
                        </div>
                        <div className={styles.formRow}>
                           
                        </div>
                    </div>
                </div>
            </ModalBody>
        </Modal>
    </>
}
export default AddBillItemsModal;