import React, { useState } from 'react';
import { Modal, ModalBody, Select, SelectItem, TextArea } from '@carbon/react';
import styles from './transition-patient.component.scss';
import { type QueueEntryResult } from '../../../registry/types';
import { transitionQueueEntry } from '../../service.resource';
import { type TransitionQueueEntryDto } from '../../../types/types';
import { QUEUE_PRIORITIES_UUIDS, QUEUE_STATUS_UUIDS } from '../../../shared/constants/concepts';
import { showSnackbar } from '@openmrs/esm-framework';
interface TransitionPatientModalProps {
  open: boolean;
  onModalClose: () => void;
  currentQueueEntry: QueueEntryResult;
}
const TransitionPatientModal: React.FC<TransitionPatientModalProps> = ({ open, onModalClose, currentQueueEntry }) => {
  const [selectedComment, setSelectedComment] = useState<string>();
  const [selectedPriority, setSelectedPriority] = useState<string>();
  const [selectedStatus, setSelectedStatus] = useState<string>();

  const statusChangeHandler = (statusUuid: string) => {
    setSelectedStatus(statusUuid);
  };

  const transtionQueueEntry = async () => {
    const payload = getTransitionQueueEntryPayload();
    try {
      await transitionQueueEntry(payload);
      showAlert('success', 'Client succesfully Transitioned', '');
      onModalClose();
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
  const getTransitionQueueEntryPayload = (): TransitionQueueEntryDto => {
    const payload: TransitionQueueEntryDto = {
      queueEntryToTransition: currentQueueEntry.queue_entry_uuid,
      newQueue: currentQueueEntry.service_uuid,
      newStatus: selectedStatus,
      newPriority: selectedPriority,
      newPriorityComment: selectedComment,
    };

    return payload;
  };
  const priorityChangeHandler = (priorityUuid: string) => {
    setSelectedPriority(priorityUuid);
  };
  const handleCommentChange = (comment: string) => {
    setSelectedComment(comment);
  };
  return (
    <>
      <Modal
        open={open}
        size="md"
        onSecondarySubmit={() => onModalClose()}
        onRequestClose={() => onModalClose()}
        onRequestSubmit={transtionQueueEntry}
        primaryButtonText="Transition"
        secondaryButtonText="Cancel"
      >
        <ModalBody>
          <div className={styles.modelLayout}>
            <div className={styles.sectionHeader}>
              <h4>Move Client</h4>
            </div>
            <div className={styles.formSection}>
              <div className={styles.formRow}>
                <div className={styles.formControl}>
                  <Select
                    id="queue-status"
                    labelText="Select Queue Status"
                    onChange={(e) => statusChangeHandler(e.target.value)}
                  >
                    <SelectItem value="" text="" />;
                    <SelectItem value={QUEUE_STATUS_UUIDS.WAITING_UUID} text="IN WAITING" />;
                    <SelectItem value={QUEUE_STATUS_UUIDS.IN_SERVICE_UUID} text="IN SERVICE" />;
                    <SelectItem value={QUEUE_STATUS_UUIDS.COMPLETED_UUID} text="COMPLETED" />;
                  </Select>
                </div>
                <div className={styles.formControl}>
                  <Select
                    id="priority"
                    labelText="Select a Priority"
                    onChange={(e) => priorityChangeHandler(e.target.value)}
                  >
                    <SelectItem value="" text="Select" />;
                    <SelectItem value={QUEUE_PRIORITIES_UUIDS.NORMAL_PRIORITY_UUID} text="NORMAL" />;
                    <SelectItem value={QUEUE_PRIORITIES_UUIDS.EMERGENCY_PRIORITY_UUID} text="EMERGENCY" />;
                  </Select>
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formControl}>
                  <TextArea
                    enableCounter
                    helperText="Comment"
                    id="comment"
                    labelText="Comment"
                    maxCount={500}
                    placeholder="Comment"
                    onChange={(e) => handleCommentChange(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default TransitionPatientModal;
