import React, { useState } from 'react';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import PreauthList from './preauth-list.component';
import Preauths from '../facility-bills/preauths.component';
import ElectiveRequestsList from './elective/elective-requests-list.component';
import styles from '../facility-bills/facility-bills.component.scss';

interface PreauthorizationsTabProps {
  locationUuid: string;
  billingDate: string;
  onDateChange?: (value: string) => void;
}

/**
 * Preauthorizations dashboard tab.
 *
 * Order: Needs raise → Elective requests → Status.
 * - Needs raise: queue to start normal/special preauth
 * - Elective requests: holding rows from chart elective capture
 * - Status: live HIE preview / doctor-consent resend
 */
const PreauthorizationsTab: React.FC<PreauthorizationsTabProps> = ({
  locationUuid,
  billingDate,
  onDateChange,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <div className={styles.panel}>
      <Tabs selectedIndex={selectedIndex} onChange={({ selectedIndex: i }) => setSelectedIndex(i)}>
        <TabList aria-label="Preauthorizations">
          <Tab>Needs raise</Tab>
          <Tab>Elective requests</Tab>
          <Tab>Status</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <PreauthList locationUuid={locationUuid} billingDate={billingDate} onDateChange={onDateChange} />
          </TabPanel>
          <TabPanel>
            <ElectiveRequestsList locationUuid={locationUuid} />
          </TabPanel>
          <TabPanel>
            <div className={styles.subPanel}>
              <Preauths locationUuid={locationUuid} billingDate={billingDate} />
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default PreauthorizationsTab;
