import React from 'react';
import styles from './nicu-queues.component.scss';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import FacilityAndWorkerSlot from '../../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
import NICUConsultation from './queues/consultation/nicu-consultation';
interface NICUQueuesProps {}
const NICUQueues: React.FC<NICUQueuesProps> = () => {
  return (
    <div className={styles.nicuLayout}>
      <div className={styles.nicuSection}>
            <FacilityAndWorkerSlot />
      </div>
      <div className={styles.nicuHeader}>
        <h4>NICU/NBU</h4>
      </div>
      <div className={styles.nicuContent}>
        <Tabs>
          <TabList contained>
            <Tab>Consultation</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <NICUConsultation />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};
export default NICUQueues;
