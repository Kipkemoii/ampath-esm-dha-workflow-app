import { Modal, ModalBody, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { type HieClient } from '../../types';
import React, { useState } from 'react';
import styles from './client-details-modal.scss';
import ClientDetails from '../../client-details/client-details';
import PaymentOptionsComponent from '../../payment-details/payment-options/payment-options';
import { type CreateClientPaymentModeDto, type HieClientPaymentMode, type PaymentMode } from '../../../shared/types';
import { createClientPaymentMode } from '../../../shared/services/client-payment-mode.resource';
import { showSnackbar } from '@openmrs/esm-framework';

interface ClientDetailsModalProps {
  client: HieClient;
  open: boolean;
  onModalClose: () => void;
  onSubmit: () => void;
  onSendClientToTriage: (crId: string) => void;
}

const ClientDetailsModal: React.FC<ClientDetailsModalProps> = ({
  client,
  open,
  onModalClose,
  onSubmit,
  onSendClientToTriage,
}) => {
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<PaymentMode>();
  const [clientPaymentMode, setClientPaymentMode] = useState<HieClientPaymentMode>();
  if (!client) {
    return <>No Client data</>;
  }
  const handleSelectedPatientOption = (selectedPaymentMode: PaymentMode) => {
    setSelectedPaymentMode(selectedPaymentMode);
    addClientPaymentMode(selectedPaymentMode);
  };
  const generateClientPaymentModePayload = (selectedPaymentMode: PaymentMode): CreateClientPaymentModeDto => {
    return {
      clientId: client.id,
      paymentModeUuid: selectedPaymentMode.uuid,
    };
  };
  const addClientPaymentMode = async (selectedPaymentMode: PaymentMode) => {
    const paymentModePayload = generateClientPaymentModePayload(selectedPaymentMode);
    try {
      const resp = await createClientPaymentMode(paymentModePayload);
      if (resp) {
        setClientPaymentMode(resp);
        showSnackbar({
          kind: 'success',
          title: 'Payment method set succesfully',
          subtitle: `Client Payment method has been set to ${selectedPaymentMode.name} succesfully`,
        });
      }
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Error setting client payment method',
        subtitle: 'An error ocurred while setting the client payment method. Please retry or contact support',
      });
    }
  };
  const confirmPatientDetails = () => {
    if (!clientPaymentMode) {
      showSnackbar({
        kind: 'error',
        title: 'Missing Payment method',
        subtitle: 'Please select a payment method before proceeding',
      });
    } else {
      onSendClientToTriage(client.id);
    }
  };
  return (
    <>
      <Modal
        open={open}
        size="lg"
        onSecondarySubmit={onModalClose}
        onRequestClose={onModalClose}
        onRequestSubmit={confirmPatientDetails}
        primaryButtonText="Send To Triage"
        secondaryButtonText="Cancel"
      >
        <ModalBody>
          <div className={styles.clientDetailsLayout}>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>Patient Details</h4>
            </div>
            <div className={styles.sectionContent}>
              <Tabs>
                <TabList contained>
                  <Tab>Patient Details</Tab>
                  <Tab>Payment Details</Tab>
                </TabList>
                <TabPanels>
                  <TabPanel>
                    <ClientDetails client={client} />
                  </TabPanel>
                  <TabPanel>
                    <PaymentOptionsComponent onSelectPaymentMethod={handleSelectedPatientOption} />
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default ClientDetailsModal;
