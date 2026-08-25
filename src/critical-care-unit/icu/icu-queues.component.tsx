import React from 'react';
import styles from './icu-queues.component.scss';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import FacilityAndWorkerSlot from '../../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
import ICUConsultation from './queues/consultation/icu-consultation';
interface ICUQueuesProps {}
const ICUQueues: React.FC<ICUQueuesProps> = () => {
  return (
    <div className={styles.icuLayout}>
      <div className={styles.icuSection}>
            <FacilityAndWorkerSlot />
      </div>
      <div className={styles.icuHeader}>
        <h4>ICU</h4>
      </div>
      <div className={styles.icuContent}>
        <Tabs>
          <TabList contained>
            <Tab>Consultation</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <ICUConsultation />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};
export default ICUQueues;
