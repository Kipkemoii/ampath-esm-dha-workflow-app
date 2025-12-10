import React from 'react';
import { Modal, ModalBody } from '@carbon/react';
import { type QueueEntryResult } from '../../../registry/types';
import styles from './serve-patient.comppnent.scss';
import { type TransitionQueueEntryDto } from '../../../types/types';
import { QUEUE_STATUS_UUIDS } from '../../../shared/constants/concepts';
import { transitionQueueEntry } from '../../service.resource';
import { showSnackbar } from '@openmrs/esm-framework';

interface ServePatientModal {
  open: boolean;
  onModalClose: () => void;
  currentQueueEntry: QueueEntryResult;
  onSuccessfullServe: () => void;
}

const ServePatientModal: React.FC<ServePatientModal> = ({
  open,
  onModalClose,
  currentQueueEntry,
  onSuccessfullServe,
}) => {
  const servePatient = async () => {
    const payload = getServePatientPayload();
    try {
      await transitionQueueEntry(payload);
      showAlert('success', 'Client succesfully served', '');
      onSuccessfullServe();
    } catch (e) {
      showAlert('error', e.message, '');
    }
  };
  const showAlert = (alertType: 'error' | 'success', title: string, subtitle: string) => {
    showSnackbar({
      kind: alertType,
      title: title,
      subtitle: subtitle,
    });
  };
  const getServePatientPayload = (): TransitionQueueEntryDto => {
    const payload: TransitionQueueEntryDto = {
      queueEntryToTransition: currentQueueEntry.queue_entry_uuid,
      newQueue: currentQueueEntry.service_uuid,
      newStatus: QUEUE_STATUS_UUIDS.IN_SERVICE_UUID,
    };

    return payload;
  };
  return (
    <>
      <Modal
        modalHeading="Serve Client"
        open={open}
        size="md"
        onSecondarySubmit={() => onModalClose()}
        onRequestClose={() => onModalClose()}
        onRequestSubmit={servePatient}
        primaryButtonText="Serve"
        secondaryButtonText="Cancel"
      >
        <ModalBody>
          <div className={styles.serveModalLayout}>
            <div className={styles.serveModalContentSection}>
              <div className={styles.formRow}>
                <p>
                  Name: {currentQueueEntry.family_name} {currentQueueEntry.middle_name} {currentQueueEntry.given_name}
                </p>
                <p>Ticket No: {currentQueueEntry.queue_entry_id}</p>
                <p>Status: {currentQueueEntry.status}</p>
                <p>Priority: {currentQueueEntry.priority}</p>
              </div>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default ServePatientModal;
