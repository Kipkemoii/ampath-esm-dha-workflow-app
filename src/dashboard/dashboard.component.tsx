import React, { useEffect, useState } from 'react';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';

import styles from './dashboard.component.scss';
import Overview from './overview/overview.component';
import { getServiceQueueByLocationUuid } from '../service-queues/service-queues.resource';
import { type QueueEntryResult } from '../registry/types';
import { useSession } from '@openmrs/esm-framework';
import { QUEUE_SERVICE_UUIDS } from '../shared/constants/concepts';

interface DashboardProps {}

const Dashboard: React.FC<DashboardProps> = () => {
  const [triageQueueEntries, setTriageQueueEntries] = useState<QueueEntryResult[]>([]);
  const [consultationQueueEntries, setConsultationQueueEntries] = useState<QueueEntryResult[]>([]);
  const session = useSession();
  const locationUuid = session.sessionLocation.uuid;
  const triageServiceUuid = QUEUE_SERVICE_UUIDS.TRIAGE_SERVICE_UUID;
  const consultationServiceUuid = QUEUE_SERVICE_UUIDS.CLINICAL_CONSULTATION_SERVICE_UUID;
  useEffect(() => {
    getTriageEntryQueues();
    getConsultationEntryQueues();
  }, []);

  const getTriageEntryQueues = async () => {
    const res = await getServiceQueueByLocationUuid(triageServiceUuid, locationUuid);
    setTriageQueueEntries(res);
  };
  const getConsultationEntryQueues = async () => {
    const res = await getServiceQueueByLocationUuid(consultationServiceUuid, locationUuid);
    setConsultationQueueEntries(res);
  };
  return (
    <div className={styles.container}>
      <Tabs>
        <TabList contained fullWidth scrollDebounceWait={200}>
          <Tab>
            <span className={styles.tabText}>Overview</span>
          </Tab>
          <Tab>
            <span>Pharmacy</span>
          </Tab>
          <Tab>
            <span className={styles.tabText}>Labs</span>
          </Tab>
          <Tab>
            <span className={styles.tabText}>Programs</span>
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <Overview triageCount={triageQueueEntries} consultationCount={consultationQueueEntries} />
          </TabPanel>
          <TabPanel></TabPanel>
          <TabPanel></TabPanel>
          <TabPanel></TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default Dashboard;
