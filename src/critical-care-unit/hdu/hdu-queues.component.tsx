import React from 'react';
import styles from './hdu-queues.component.scss';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import FacilityAndWorkerSlot from '../../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
import HDUConsultation from './queues/consultation/hdu-consultation';
interface HDUQueuesProps {}
const HDUQueues: React.FC<HDUQueuesProps> = () => {
  return (
    <div className={styles.hduLayout}>
      <div className={styles.hduSection}>
            <FacilityAndWorkerSlot />
      </div>
      <div className={styles.hduHeader}>
        <h4>HDU</h4>
      </div>
      <div className={styles.hduContent}>
        <Tabs>
          <TabList contained>
            <Tab>Consultation</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <HDUConsultation />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};
export default HDUQueues;
