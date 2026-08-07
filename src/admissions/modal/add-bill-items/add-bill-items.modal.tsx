import React, { useEffect, useState } from "react";
import { Button, ComboBox, Modal, ModalBody } from "@carbon/react";
import styles from './add-bill-items.modal.scss';
import { showSnackbar, useSession, useVisit } from "@openmrs/esm-framework";
import { createBill, fetchBillableServices, fetchCashPoints, fetchCurrentDayPendingPatientBills, updateBill } from "../../../shared/services/billing.resource";
import { type CreateBillDto, type LineItem, type ServicePrice, type BillableService } from "../../../shared/types";
import { generateUpdateBillLineItems } from "../../../billing/utils";

interface addBillItemsModalProps {
    crId: string;
    patientUuid: string;
    onModalClose: ()=>void;
    onAddBillItems: ()=>void;
    open: boolean;
}

type DraftBillItem = {
    id: string;
    billableService: BillableService | null;
    servicePrice: ServicePrice | null;
};

const createDraftItem = (): DraftBillItem => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    billableService: null,
    servicePrice: null,
});

const AddBillItemsModal: React.FC<addBillItemsModalProps> = ({ crId, patientUuid, onModalClose, onAddBillItems, open }) => {
    const [billableServices, setBillableServices] = useState<BillableService[]>([]);
    const [draftBillItems, setDraftBillItems] = useState<DraftBillItem[]>([createDraftItem()]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { activeVisit } = useVisit(patientUuid);
    const { sessionLocation } = useSession();

    useEffect(() => {
        void getBillableServices();
    }, []);

    async function getBillableServices() {
        const services = await fetchBillableServices();
        setBillableServices(services);
    }

    function addBillItem() {
        setDraftBillItems((current) => [...current, createDraftItem()]);
    }

    function handleSelectBillableService(rowId: string, selectedBillService: BillableService | null) {
        setDraftBillItems((current) =>
            current.map((row) =>
                row.id === rowId
                    ? {
                          ...row,
                          billableService: selectedBillService,
                          servicePrice: null,
                      }
                    : row,
            ),
        );
    }

    function handleSelectBillableServicePrice(rowId: string, servicePrice: ServicePrice | null) {
        setDraftBillItems((current) =>
            current.map((row) =>
                row.id === rowId
                    ? {
                          ...row,
                          servicePrice,
                      }
                    : row,
            ),
        );
    }

    function removeDraftBillItem(rowId: string) {
        setDraftBillItems((current) => (current.length > 1 ? current.filter((row) => row.id !== rowId) : current));
    }

    function buildLineItems(startOrder = 0): LineItem[] {
        return draftBillItems
            .filter((item) => item.billableService && item.servicePrice)
            .map((item, index) => {
                const servicePrice = item.servicePrice as ServicePrice;
                const price = Number(servicePrice?.price ?? 0);
                const status: LineItem['status'] = price === 0 ? 'PAID' : 'PENDING';

                return {
                    billableService: servicePrice?.billableService?.uuid ?? '',
                    quantity: 1,
                    price,
                    priceName: servicePrice?.name ?? 'Default',
                    priceUuid: servicePrice?.uuid ?? '',
                    lineItemOrder: startOrder + index,
                    status,
                };
            })
            .filter((lineItem) => Boolean(lineItem.billableService && lineItem.priceUuid));
    }

    async function handleRequestSubmit() {
        const validDraftBillItems = draftBillItems.filter((item) => item.billableService && item.servicePrice);

        if (!validDraftBillItems.length) {
            showSnackbar({
                title: 'No bill items selected',
                subtitle: 'Select at least one bill item before submitting',
                kind: 'warning',
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const currentDayPendingBills = await fetchCurrentDayPendingPatientBills(patientUuid);

            if (currentDayPendingBills?.length) {
                const currentBill = currentDayPendingBills[0];
                const initialLineItems = generateUpdateBillLineItems(currentBill, billableServices as any);
                const maxLineItemOrder = initialLineItems.reduce((max, lineItem) => {
                    return Math.max(max, Number(lineItem?.lineItemOrder ?? -1));
                }, -1);

                const newLineItems = buildLineItems(maxLineItemOrder + 1);
                await updateBill(currentBill.uuid, {
                    lineItems: [...initialLineItems, ...newLineItems],
                });
            } else {
                const cashPoints = await fetchCashPoints();
                const locationCashPoint = cashPoints.find((cp) => cp?.location?.uuid === sessionLocation?.uuid) ?? cashPoints?.[0];

                if (!locationCashPoint?.uuid) {
                    throw new Error('No cashpoint configured for this location');
                }

                const payload: CreateBillDto = {
                    lineItems: buildLineItems(0),
                    cashPoint: locationCashPoint.uuid,
                    patient: patientUuid,
                    visit: activeVisit?.uuid ?? '',
                    status: 'PENDING',
                    payments: [],
                };

                await createBill(payload);
            }

            showSnackbar({
                title: 'Bill updated',
                subtitle: 'Bill items were added successfully',
                kind: 'success',
            });
            onAddBillItems();
        } catch (error) {
            showSnackbar({
                title: 'Error',
                subtitle: error?.message ?? 'Failed to add bill items',
                kind: 'error',
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <>
            <Modal
                modalHeading="Admit Patient"
                open={open}
                size="lg"
                onSecondarySubmit={() => onModalClose()}
                onRequestClose={() => onModalClose()}
                onRequestSubmit={handleRequestSubmit}
                primaryButtonText="Add Charge Items"
                primaryButtonDisabled={isSubmitting || !draftBillItems.some((item) => item.billableService && item.servicePrice)}
                secondaryButtonText="Cancel"
            >
                <ModalBody>
                    <div className={styles.addBillItemsModalLayout}>
                        <div className={styles.addBillItemsModalContentSection}>
                            {draftBillItems.map((draftItem, index) => {
                                const availableServicePrices = draftItem.billableService?.servicePrices ?? [];

                                return (
                                    <div className={styles.formRow} key={draftItem.id}>
                                        <div className={styles.inputWidth}>
                                            <ComboBox
                                                id={`billable-service-${draftItem.id}`}
                                                titleText={`Billable Service ${index + 1}`}
                                                placeholder="Search Billable service"
                                                items={billableServices ?? []}
                                                itemToString={(item) => item?.name ?? ''}
                                                selectedItem={draftItem.billableService}
                                                onChange={({ selectedItem }) => handleSelectBillableService(draftItem.id, selectedItem)}
                                            />
                                        </div>
                                        <div className={styles.inputWidth}>
                                            <ComboBox
                                                id={`billable-service-price-${draftItem.id}`}
                                                titleText={`Price ${index + 1}`}
                                                placeholder={draftItem.billableService ? 'Search billable service price' : 'Select a billable service first'}
                                                items={availableServicePrices}
                                                itemToString={(item: ServicePrice) => `${item?.name} - KES ${item?.price}`}
                                                selectedItem={draftItem.servicePrice}
                                                disabled={!draftItem.billableService}
                                                onChange={({ selectedItem }) => handleSelectBillableServicePrice(draftItem.id, selectedItem)}
                                            />
                                        </div>
                                        <div className={styles.inputWidth}>
                                            <Button
                                                kind="danger--tertiary"
                                                onClick={() => removeDraftBillItem(draftItem.id)}
                                                disabled={draftBillItems.length === 1}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                            <div className={styles.formRow}>
                                <div className={styles.inputWidth}>
                                    <Button onClick={addBillItem}>Add another line item</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </ModalBody>
            </Modal>
        </>
    );
}
export default AddBillItemsModal;