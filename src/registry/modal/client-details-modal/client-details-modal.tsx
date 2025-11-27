import { Button, Modal, ModalBody, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { type HieClient } from '../../types';
import React from 'react';
import styles from './client-details-modal.scss';
import ClientDetails from '../../client-details/client-details';
import PaymentOptionsComponent from '../../payment-details/payment-options/payment-options';

interface ClientDetailsModalProps {
  client: HieClient;
  open: boolean;
  onModalClose: () => void;
  onSubmit: () => void;
}

const ClientDetailsModal: React.FC<ClientDetailsModalProps> = ({ client, open, onModalClose, onSubmit }) => {
  if (!client) {
    return <>No Client data</>;
  }
  return (
    <>
      <Modal
        open={open}
        size="md"
        onSecondarySubmit={onModalClose}
        onRequestClose={onModalClose}
        onRequestSubmit={onSubmit}
        primaryButtonText=""
        secondaryButtonText="Cancel"
      >
        <ModalBody>
          <div className={styles.clientDetailsLayout}>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>Patient/Payment Details</h4>
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
                    <PaymentOptionsComponent />
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </div>
            <div className={styles.actionSection}>
              <div className={styles.btnContainer}>
                <Button kind="primary">Book Appointment</Button>
              </div>
              <div className={styles.btnContainer}>
                <Button kind="secondary">Walk In Orders</Button>
              </div>
              <div className={styles.btnContainer}>
                <Button kind="tertiary">Send To Triage</Button>
              </div>
              <div className={styles.btnContainer}>
                <Button kind="primary">Send To Consultation</Button>
              </div>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default ClientDetailsModal;
