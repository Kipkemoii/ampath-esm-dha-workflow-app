import React, { useEffect, useState } from 'react';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import PreauthList from './preauth-list.component';
import Preauths from '../facility-bills/preauths.component';
import ElectiveRequestsList from '../../v3/preauth/elective/elective-requests-list.component';
import styles from '../facility-bills/facility-bills.component.scss';

interface PreauthorizationsTabProps {
  locationUuid: string;
  billingDate: string;
  onDateChange?: (value: string) => void;
}

/**
 * Preauthorizations dashboard tab:
 * - Needs raise: queue of interventions still needing preauth (raise from facility bill details)
 * - Elective requests: holding rows from chart elective capture
 * - Status: live HIE preview / doctor-consent resend (monitoring only)
 */
const PreauthorizationsTab: React.FC<PreauthorizationsTabProps> = ({ locationUuid, billingDate, onDateChange }) => {
  const [subTab, setSubTab] = useState(0);
  // Carbon keeps both panels in the DOM, so both views used to load on mount — and each
  // reads GET /pre-auth/preview once per claim, so opening this tab cost two passes over
  // the day's claims when only one was being looked at. A visited panel stays mounted, so
  // switching back and forth doesn't refetch.
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));
  useEffect(() => {
    setVisited((prev) => (prev.has(subTab) ? prev : new Set(prev).add(subTab)));
  }, [subTab]);

  return (
    <div className={styles.panel}>
      <Tabs selectedIndex={subTab} onChange={({ selectedIndex }) => setSubTab(selectedIndex)}>
        <TabList aria-label="Preauthorization views" scrollDebounceWait={200}>
          <Tab>Needs raise</Tab>
          <Tab>Elective requests</Tab>
          <Tab>Status</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            {visited.has(0) && (
              <PreauthList locationUuid={locationUuid} billingDate={billingDate} onDateChange={onDateChange} />
            )}
          </TabPanel>
          <TabPanel>{visited.has(1) && <ElectiveRequestsList locationUuid={locationUuid} />}</TabPanel>
          <TabPanel>{visited.has(2) && <Preauths locationUuid={locationUuid} billingDate={billingDate} />}</TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default PreauthorizationsTab;
