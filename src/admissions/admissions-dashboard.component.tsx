import React, { useEffect, useMemo, useState } from 'react';
import styles from './admissions-dashboard.component.scss';
import StatCard from '../service-queues/service-queue/stats/stat-card/stat-card.component';
import { InlineLoading, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { FHIRResource, useSession } from '@openmrs/esm-framework';
import { getAdmissionLoactionData, getAdmissionRequests, getAdmittedPatientsData, getDichargedEncounters } from './admissions.resource';
import { type Disposition, type AdmissionLocationData, BedLayout, FhirEncounter, FhirBundleEntry, FhirEncounterBundle } from './types';
import AdmittedPatientsList from './admitted-list/admitted-patients-list';
import AdmissionsRequestList from './admission-request-list/admission-request-list';
import { AdmissionEncounterTypeUuids } from './constants';
import DischargedList from './discharged-list/discharged-list';

const AdmissionsDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<AdmissionLocationData>(null);
  const [admissionListData, setAdmissionListData] = useState<Disposition[]>([]);
  const [admittedPatientsData, setAdmittedPatientsData] = useState<BedLayout[]>([]);
  const [dischargeEncounterBundle,setDischargeEncounterBundle] = useState<FhirEncounterBundle>();
  const [loading, setLoading] = useState<boolean>(false);
  const session = useSession();
  const locationUuid = session.sessionLocation.uuid;
  const sortedDischargeEncounters = useMemo(()=>generateDischargeEncounters(),[dischargeEncounterBundle])
  useEffect(() => {
    fetchData();
  }, [locationUuid]);
  const fetchData = () => {
    setLoading(true);
    getDashboardData();
    getAdmissionListData();
    getAdmittedPatients();
    getDisachargedEncounters();
  }
  const getDashboardData = async () => {
    const res = await getAdmissionLoactionData(locationUuid);
    setDashboardData(res);
    setLoading(false);
  };
  const getFreeBeds = (dashboardData: AdmissionLocationData): number => {
    return (dashboardData?.totalBeds ?? 0) - (dashboardData.occupiedBeds ?? 0);
  };
  const getBedOccupancy = (dashboardData: AdmissionLocationData): number => {
    return parseFloat(((dashboardData?.occupiedBeds / dashboardData.totalBeds) * 100).toFixed(2));
  };
  const getAdmissionListData = async () => {
    const res = await getAdmissionRequests(locationUuid);
    setAdmissionListData(res);
    setLoading(false);
  };
  const getAdmittedPatients = async () => {
    const res = await getAdmittedPatientsData(locationUuid);
    setAdmittedPatientsData(res);
    setLoading(false);
  };
  const getDisachargedEncounters = async () => {
    const res = await getDichargedEncounters(AdmissionEncounterTypeUuids.DISCHARGE_ENCOUNTER_TYPE_UUID, locationUuid);
    setDischargeEncounterBundle(res);
  }
  function generateDischargeEncounters(): FhirEncounter[]{
    if(dischargeEncounterBundle && dischargeEncounterBundle.entry){
    const fhirEntries = dischargeEncounterBundle.entry ?? [];
    let dischargeEncounters: FhirEncounter[] = [];
    fhirEntries.forEach((fe) => {
      const resource = fe.resource;
      if (resource && resource.resourceType === 'Encounter') {
        dischargeEncounters.push(resource);
      }
    });
    // order encounters in desc order
    const sortedEnc = dischargeEncounters.sort((a,b)=>{
       return new Date(b.period.start).getTime() - new Date(a.period.start).getTime();
    });
    return sortedEnc;
  }else{
      return [];
  }
   
  }
  const handleRefresh = () => {
    fetchData();
  }
  return (
    <>
      <div className={styles.admissionsLayout}>
        <div className={styles.headerSection}>
          <h4>Admissions</h4>
        </div>
        <div className={styles.statsSection}>
          <>
            {dashboardData ? (
              <>
                <StatCard title="Number of beds" count={dashboardData.totalBeds} />
                <StatCard title="Admitted Patients" count={dashboardData.occupiedBeds} />
                <StatCard title="Free Beds" count={getFreeBeds(dashboardData)} />
                <StatCard title="Bed Occupancy" count={getBedOccupancy(dashboardData)} other="%" />
              </>
            ) : (
              <></>
            )}
          </>
        </div>
        <div className={styles.contentSection}>
          {
            loading ? (<>
              <InlineLoading description="Fetching Data...please wait...." />
            </>) : (<>
              <Tabs>
                <TabList contained>
                  <Tab>Admission Requests</Tab>
                  <Tab>Admitted</Tab>
                  <Tab>Discharged</Tab>
                </TabList>
                <TabPanels>
                  <TabPanel>
                    {admissionListData ? <AdmissionsRequestList
                      admissionListData={admissionListData}
                      bedLayouts={admittedPatientsData}
                      refresh={handleRefresh}
                    /> : <></>}
                  </TabPanel>
                  <TabPanel>
                    {admittedPatientsData ?
                      <AdmittedPatientsList
                        admittedPatientsData={admittedPatientsData}
                        refresh={handleRefresh}
                      /> : <></>}
                  </TabPanel>
                  <TabPanel>
                    {
                      sortedDischargeEncounters ? (<>
                        <DischargedList
                          dischargedEncounters={sortedDischargeEncounters}
                          refresh={handleRefresh}
                        />
                      </>) : (<></>)
                    }

                  </TabPanel>
                </TabPanels>
              </Tabs>
            </>)
          }

        </div>
      </div>
    </>
  );
};
export default AdmissionsDashboard;