import React from 'react';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import styles from './claims-admin-dashboard.component.scss';
import AdminClaimsList from './claims/claims-list.component';
import { useSession } from '@openmrs/esm-framework';
interface claimsAdminDashboardProps {}
const ClaimsAdminDashboard: React.FC<claimsAdminDashboardProps> = () => {
  const session = useSession();
  const locationUuid = session?.sessionLocation?.uuid ?? '';
  if(!locationUuid){
      return <>Session Location not set</>
  }
  return (
    <>
      <div className={styles.queueDashboardLayout}>
        <Tabs>
          <TabList contained>
            <Tab>Claims</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              {
                locationUuid && <AdminClaimsList locationUuid={locationUuid}/>
              }
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </>
  );
};
export default ClaimsAdminDashboard;
