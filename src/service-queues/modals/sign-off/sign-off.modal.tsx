import React from 'react';
import { Modal, ModalBody, TextInput } from '@carbon/react';
import { type EndVisitDto, type QueueEntryResult } from '../../../registry/types';
import styles from './sign-off.modal.scss';
import { showSnackbar } from '@openmrs/esm-framework';
import { endVisit } from '../../../resources/visit.resource';
import { closeQueueEntry } from '../../service-queues.resource';

interface SignOffEntryModalProps {
  open: boolean;
  onModalClose: () => void;
  currentQueueEntry: QueueEntryResult;
  onSuccessfullSignOff: () => void;
}

const SignOffEntryModal: React.FC<SignOffEntryModalProps> = ({
  open,
  onModalClose,
  currentQueueEntry,
  onSuccessfullSignOff,
}) => {
  const signOffEntry = async () => {
    const payload = getEndVisitPayload();
    try {
      await removePatientFromQueue(currentQueueEntry);
      await endVisit(currentQueueEntry.visit_uuid, payload);
      showAlert('success', 'Visit Ended successfully', '');
      onSuccessfullSignOff();
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
  const getEndVisitPayload = (): EndVisitDto => {
    return {
      stopDatetime: new Date().toISOString(),
    };
  };
  const removePatientFromQueue = async (currentQueueEntry: QueueEntryResult) => {
    try {
      await closeQueueEntry(currentQueueEntry.queue_entry_uuid);
      showAlert('success', 'Patient removal from queue successfully!', '');
    } catch (e) {
      showAlert('error', 'Patient removal from queue failed!', '');
    }
  };
  return (
    <>
      <Modal
        modalHeading="Sign Off"
        open={open}
        size="md"
        onSecondarySubmit={() => onModalClose()}
        onRequestClose={() => onModalClose()}
        onRequestSubmit={signOffEntry}
        primaryButtonText="Sign Off"
        secondaryButtonText="Cancel"
      >
        <ModalBody>
          <div className={styles.serveModalLayout}>
            <div className={styles.serveModalContentSection}>
              <div className={styles.formRow}>
                <TextInput id="health-worker-id" labelText="Enter your Provider ID" onChange={() => {}} type="text" />
              </div>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default SignOffEntryModal;
