import React from 'react';
import styles from './icu-burns-queues.component.scss';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import FacilityAndWorkerSlot from '../../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
import ICUBurnsConsultation from './queues/consultation/icu-burns-consultation';
const ICUBurnsQueues: React.FC = () => {
  return (
    <div className={styles.icuLayout}>
      <div className={styles.icuSection}>
            <FacilityAndWorkerSlot />
      </div>
      <div className={styles.icuHeader}>
        <h4>NICU Burns Unit</h4>
      </div>
      <div className={styles.icuContent}>
        <Tabs>
          <TabList contained>
            <Tab>Consultation</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <ICUBurnsConsultation />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};
export default ICUBurnsQueues;
