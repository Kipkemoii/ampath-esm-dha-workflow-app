import React, { useEffect, useMemo, useState } from 'react';
import { type QueueEntryResult } from '../../registry/types';
import { useSession } from '@openmrs/esm-framework';
import { getServiceQueueByLocationUuid } from '../service-queues.resource';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import QueueList from '../queue-list/queue-list.component';
import styles from './service-queue.component.scss';
import MovePatientModal from '../modals/move/move-patient.component';
import TransitionPatientModal from '../modals/transition/transition-patient.component';
import ServePatientModal from '../modals/serve/serve-patient.comppnent';

interface ServiceQueueComponentProps {
  serviceTypeUuid: string;
  title: string;
}

const ServiceQueueComponent: React.FC<ServiceQueueComponentProps> = ({ serviceTypeUuid, title }) => {
  const [queueEntries, setQueueEntries] = useState<QueueEntryResult[]>([]);
  const [selectedQueueEntry, setSelectedQueueEntry] = useState<QueueEntryResult>();
  const [displayMoveModal, setDisplayMoveModal] = useState<boolean>();
  const [displayTransitionModal, setDisplayTransitionModal] = useState<boolean>();
  const [displayServeModal, setDisplayServeModal] = useState<boolean>();
  const session = useSession();
  const locationUuid = session.sessionLocation.uuid;

  const groupEntriesByRooms = () => {
    const roomEntries = {};
    if (!queueEntries || queueEntries.length === 0) return {};
    queueEntries.forEach((qe) => {
      const room = qe.queue_room;
      if (!roomEntries[room]) {
        roomEntries[room] = [qe];
      } else {
        roomEntries[room].push(qe);
      }
    });
    return roomEntries;
  };

  const groupedByRoom: { [key: string]: QueueEntryResult[] } = useMemo(() => groupEntriesByRooms(), [queueEntries]);

  useEffect(() => {
    getEntryQueues();
  }, []);

  const getEntryQueues = async () => {
    const res = await getServiceQueueByLocationUuid(serviceTypeUuid, locationUuid);
    setQueueEntries(res);
  };

  if (!groupedByRoom) {
    return <>No Data to Display</>;
  }
  const handleMovePatient = (queueEntry: QueueEntryResult) => {
    setDisplayMoveModal(true);
    setSelectedQueueEntry(queueEntry);
  };
  const handleModalCloes = () => {
    setDisplayMoveModal(false);
    setDisplayTransitionModal(false);
    setDisplayServeModal(false);
  };

  const handleTransitionPatient = (queueEntry: QueueEntryResult) => {
    setDisplayTransitionModal(true);
    setSelectedQueueEntry(queueEntry);
  };

  const handleServePatient = (queueEntry: QueueEntryResult) => {
    setDisplayServeModal(true);
    setSelectedQueueEntry(queueEntry);
  };

  const navigateToPatientChart = () => {
    if (selectedQueueEntry && selectedQueueEntry.patient_uuid) {
      window.location.href = `${window.spaBase}/patient/${selectedQueueEntry.patient_uuid}/chart`;
    }
  };

  const handleSuccessfullServe = () => {
    handleModalCloes();
    navigateToPatientChart();
  };

  if (!serviceTypeUuid) {
    return <>No service type defined</>;
  }

  return (
    <>
      <div className={styles.consultationLayout}>
        <div className={styles.headerSection}>
          <h4>{title}</h4>
        </div>
        <div className={styles.contentSection}>
          <Tabs>
            <TabList contained>
              {groupedByRoom &&
                Object.keys(groupedByRoom).map((key) => {
                  return <Tab>{key}</Tab>;
                })}
            </TabList>
            <TabPanels>
              {groupedByRoom &&
                Object.keys(groupedByRoom).map((key) => {
                  return (
                    <TabPanel>
                      {
                        <QueueList
                          queueEntries={groupedByRoom[key]}
                          handleMovePatient={handleMovePatient}
                          handleTransitionPatient={handleTransitionPatient}
                          handleServePatient={handleServePatient}
                        />
                      }
                    </TabPanel>
                  );
                })}
            </TabPanels>
          </Tabs>
        </div>
      </div>
      {displayMoveModal && selectedQueueEntry ? (
        <>
          <MovePatientModal
            open={displayMoveModal}
            locationUuid={locationUuid}
            serviceUuid={serviceTypeUuid}
            onModalClose={handleModalCloes}
            currentQueueEntryUuid={selectedQueueEntry.queue_entry_uuid}
          />
        </>
      ) : (
        <></>
      )}

      {displayTransitionModal ? (
        <>
          <TransitionPatientModal
            open={displayTransitionModal}
            onModalClose={handleModalCloes}
            currentQueueEntry={selectedQueueEntry}
          />
        </>
      ) : (
        <></>
      )}

      {displayServeModal ? (
        <>
          <ServePatientModal
            open={displayServeModal}
            onModalClose={handleModalCloes}
            currentQueueEntry={selectedQueueEntry}
            onSuccessfullServe={handleSuccessfullServe}
          />
        </>
      ) : (
        <></>
      )}
    </>
  );
};

export default ServiceQueueComponent;
