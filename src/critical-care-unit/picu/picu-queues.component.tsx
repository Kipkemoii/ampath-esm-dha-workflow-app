import React from 'react';
import styles from './picu-queues.component.scss';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import FacilityAndWorkerSlot from '../../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
import PICUConsultation from './queues/consultation/picu-consultation';
interface ICUQueuesProps {}
const PICUQueues: React.FC<ICUQueuesProps> = () => {
  return (
    <div className={styles.picuLayout}>
      <div className={styles.picuSection}>
            <FacilityAndWorkerSlot />
      </div>
      <div className={styles.picuHeader}>
        <h4>PICU</h4>
      </div>
      <div className={styles.picuContent}>
        <Tabs>
          <TabList contained>
            <Tab>Consultation</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <PICUConsultation />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};
export default PICUQueues;
