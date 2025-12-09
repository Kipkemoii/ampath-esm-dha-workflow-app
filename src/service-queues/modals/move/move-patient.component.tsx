import { Button, Modal, ModalBody, Select, SelectItem, TextArea } from '@carbon/react';
import React, { useEffect, useState } from 'react';
import styles from './move-patient.component.scss';
import { type ServiceQueue } from '../../../registry/types';
import { getServiceQueueByLocation, transitionQueueEntry } from '../../service.resource';
import { type TransitionQueueEntryDto } from '../../../types/types';
import { QUEUE_PRIORITIES_UUIDS, QUEUE_STATUS_UUIDS } from '../../../shared/constants/concepts';
import { showSnackbar } from '@openmrs/esm-framework';
interface MovePatientModalProps {
  open: boolean;
  onModalClose: () => void;
  locationUuid: string;
  serviceUuid: string;
  currentQueueEntryUuid: string;
}
const MovePatientModal: React.FC<MovePatientModalProps> = ({
  open,
  onModalClose,
  locationUuid,
  serviceUuid,
  currentQueueEntryUuid,
}) => {
  const [serviceQueues, setServiceQueues] = useState<ServiceQueue[]>([]);
  const [selectedComment, setSelectedComment] = useState<string>();
  const [selectedPriority, setSelectedPriority] = useState<string>();
  const [selectedNewService, setSelectedNewService] = useState<ServiceQueue>();
  useEffect(() => {
    getQueues();
  }, [locationUuid]);
  const serviceChangeHandler = (serviceQueueUuid: string) => {
    const serviceQueue = serviceQueues.find((sq) => {
      return sq.uuid === serviceQueueUuid;
    });
    setSelectedNewService(serviceQueue);
  };
  const getQueues = async () => {
    const res = await getServiceQueueByLocation(locationUuid);
    setServiceQueues(res);
  };
  const transtionQueueEntry = async () => {
    const payload = getTransitionQueueEntryPayload();
    try {
      const resp = await transitionQueueEntry(payload);
      showAlert('success', 'Cleint succesfully moved', '');
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
      queueEntryToTransition: currentQueueEntryUuid,
      newQueue: selectedNewService.uuid,
      newStatus: QUEUE_STATUS_UUIDS.WAITING_UUID,
      newPriority: selectedPriority,
      newPriorityComment: selectedComment,
    };

    return payload;
  };
  const priorityChangeHandler = (priorityUuid: string) => {
    setSelectedPriority(priorityUuid);
  };
  const handleCommentChange = (comment: string) => {};
  return (
    <>
      <Modal
        open={open}
        size="md"
        onSecondarySubmit={() => onModalClose()}
        onRequestClose={() => onModalClose()}
        onRequestSubmit={transtionQueueEntry}
        primaryButtonText="Move"
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
                    id="service-queue"
                    labelText="Select the new Queue"
                    onChange={(e) => serviceChangeHandler(e.target.value)}
                  >
                    <SelectItem value="" text="" />;
                    {serviceQueues &&
                      serviceQueues.map((vt) => {
                        return <SelectItem value={vt.uuid} text={vt.name} />;
                      })}
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

export default MovePatientModal;
