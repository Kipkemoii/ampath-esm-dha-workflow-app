import React from 'react';
import { useFacilityClaimVisits } from '../../../billing-claims.resource';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import SHAClaimsTable from './sha-claims-table.component';

import styles from './sha-claims.scss';

interface ShaClaimsComponentTabProps {
  locationUuid: string;
  billingDate: string;
}
const ShaClaimsComponentTab: React.FC<ShaClaimsComponentTabProps> = ({ locationUuid, billingDate }) => {
  const {
    claimVisits,
    loading: claimsLoading,
    reload: loadClaimVisits,
  } = useFacilityClaimVisits(locationUuid, billingDate);
  return (
    <>
      <div className={styles.panel}>
        <Tabs onTabCloseRequest={function Bz() {}}>
          <TabList scrollDebounceWait={200}>
            <Tab>Drafts</Tab>
            <Tab>Submitted</Tab>
            <Tab>Rejected</Tab>
            <Tab>Approved</Tab>
            <Tab>Needs resubmission</Tab>
            <Tab>Paid</Tab>
            <Tab>Closed</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <SHAClaimsTable claimVisits={claimVisits} />
            </TabPanel>
            <TabPanel>
              <SHAClaimsTable claimVisits={claimVisits} />
            </TabPanel>
            <TabPanel>
              <SHAClaimsTable claimVisits={claimVisits} />
            </TabPanel>
            <TabPanel>
              <SHAClaimsTable claimVisits={claimVisits} />
            </TabPanel>
            <TabPanel>
              <SHAClaimsTable claimVisits={claimVisits} />
            </TabPanel>
            <TabPanel>
              <SHAClaimsTable claimVisits={claimVisits} />
            </TabPanel>
            <TabPanel>
              <SHAClaimsTable claimVisits={claimVisits} />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </>
  );
};

export default ShaClaimsComponentTab;
