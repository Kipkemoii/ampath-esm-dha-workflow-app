import React, { useEffect, useMemo, useState } from 'react';
import {
  type PatientFacilityBillDetails,
  type PatientBillVisit,
  type ClaimsVisit,
  type PatientPayment,
  type PatientPaymentsDto,
} from '../types';
import {
  fetchMaternityDiagnosis,
  fetchPatientBillDetails,
  fetchPatientBillPayments,
  fetchPatientDiagnosis,
  fetchPatientEncounterDiagnosis,
  fetchPatientVisits,
} from '../../../billing-claims.resource';
import { RadioButton, RadioButtonGroup, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { formatDate, parseDate, showSnackbar } from '@openmrs/esm-framework';

import styles from './patient-visit.scss';
import BillDetails from './bill-details/bill-details';
import PatientClaimDetails from './claim-details/patient-claim-details.component';
import { type AmrsMaternityDiagnosisDto, type AmrsVisitDiagnosisDto, type AmrsVisitDiagnosis } from '../../../types';

interface PatientVisitDetailsComponentProps {
  patientUuid: string;
  billingDate: string;
  locationUuid: string;
}

const PatientVisitDetailsComponent: React.FC<PatientVisitDetailsComponentProps> = ({
  patientUuid,
  locationUuid,
  billingDate,
}) => {
  const [patientVisits, setPatientVisits] = useState<PatientBillVisit[]>([]);
  const [selectedVisitUuid, setSelectedVisitUuid] = useState<string>('');
  const [patientBillDetails, setPatientBillDetails] = useState<PatientFacilityBillDetails[]>([]);
  const [claimDetails, setClaimDetails] = useState([]);
  const [claimsVisit, setClaimsVisit] = useState<ClaimsVisit>();
  const [patientBillPayments, setPatientBillPayments] = useState<PatientPayment[]>([]);
  const [visitDiagnosis, setVisitDiagnosis] = useState<AmrsVisitDiagnosis[]>([]);
  const [maternityDiagnosis, setMaternityDiagnosis] = useState<AmrsVisitDiagnosis[]>([]);
  const [encounterDiagnosis, setEncounterDiagnosis] = useState<AmrsVisitDiagnosis[]>([]);
  const patientAmrsVisitDiagnosis = useMemo(
    () => [...visitDiagnosis, ...maternityDiagnosis, ...encounterDiagnosis],
    [visitDiagnosis, maternityDiagnosis, encounterDiagnosis],
  );
  const [visitDiagnosisLoading, setVisitDiagnosisLoading] = useState<boolean>(true);
  const [maternityDiagnosisLoading, setMaternityDiagnosisLoading] = useState<boolean>(true);
  const [encounterDiagnosisLoading, setEncounterDiagnosisLoading] = useState<boolean>(true);
  const diagnosisLoading = visitDiagnosisLoading || maternityDiagnosisLoading || encounterDiagnosisLoading;
  const [consentToken,setConsentToken] = useState< string>('');

  const getPatientVisits = async () => {
    const res = await fetchPatientVisits(patientUuid, billingDate, locationUuid);
    setPatientVisits(res);
    if(res && res.length > 0){
     const visit = res[0];
     setSelectedVisitUuid(visit?.visit_uuid ?? '');
     setConsentToken(visit.consent_token ?? '');
    }
    
  };

  const getPatientBillDetails = async (visitUuid: string) => {
    if (selectedVisitUuid) {
      const res = await fetchPatientBillDetails(visitUuid ?? '');
      setPatientBillDetails(res);
    }
  };

  const handVisitTypeChange = (value: any) => {
    const selectedVisit = patientVisits.find((v) => {
      return (v.visit_uuid === value);
    });
    setSelectedVisitUuid(selectedVisit?.visit_uuid ?? '');
    setConsentToken(selectedVisit?.consent_token ?? '');
  };

  useEffect(() => {
    if (locationUuid && patientUuid && billingDate) {
      getPatientBillDetails(selectedVisitUuid);
      getPatientPayments();
      getPatientAmrsVisitDiagnosis();
      getPatientAmrsMaternityDiagnosis();
      getPatientAmrsEncounterDiagnosis();
    }
  }, [locationUuid, patientUuid, billingDate]);

  useEffect(() => {
    getPatientBillDetails(selectedVisitUuid);
  }, [selectedVisitUuid]);

  useEffect(() => {
    if (patientUuid && locationUuid && billingDate) {
      getPatientVisits();
    }
  }, [locationUuid, patientUuid, billingDate]);

  function onLoadingClaimVisit(claimVisit: ClaimsVisit) {
    if (claimVisit) {
      setClaimsVisit(claimVisit);
    }
  }

  async function getPatientPayments() {
    const patientPaymentPayload = getPatientPaymentsPayload();
    try {
      const resp = await fetchPatientBillPayments(patientPaymentPayload);
      if (resp && resp.length > 0) {
        setPatientBillPayments(resp);
      } else {
        setPatientBillPayments([]);
      }
    } catch (error) {
      showSnackbar({
        title: 'Error fetching patient bill payments',
        kind: 'error',
        subtitle: 'An error occurred while fetching the patient bill payments',
      });
    }
  }
  function getPatientPaymentsPayload(): PatientPaymentsDto {
    return {
      patientUuid: patientUuid,
      billingDate: billingDate,
    };
  }

  async function getPatientAmrsVisitDiagnosis() {
    setVisitDiagnosisLoading(true);
    const amrsVisitDiagnosisPayload = getPatientAmrsVisitDiagnosisPayload();
    try {
      const resp = await fetchPatientDiagnosis(amrsVisitDiagnosisPayload);
      setVisitDiagnosis(resp ?? []);
    } catch (error) {
      showSnackbar({
        title: 'Error fetching patient diagnosis',
        kind: 'error',
        subtitle: 'An error occurred while fetching the patient diagnosis',
      });
    } finally {
      setVisitDiagnosisLoading(false);
    }
  }
  async function getPatientAmrsMaternityDiagnosis() {
    setMaternityDiagnosisLoading(true);
    const amrsMaternityDiagnosisPayload = getPatientAmrsMaternityDiagnosisPayload();
    try {
      const resp: any = await fetchMaternityDiagnosis(amrsMaternityDiagnosisPayload);
      const results = (resp ?? [])
        .filter((r) => r?.uuid != null)
        .map((v) => ({ ...v, practitioner_identifier_type: 'National ID' }));
      setMaternityDiagnosis(results);
    } catch (error) {
      showSnackbar({
        title: 'Error fetching patient maternity diagnosis',
        kind: 'error',
        subtitle: 'An error occurred while fetching the patient maternity diagnosis',
      });
    } finally {
      setMaternityDiagnosisLoading(false);
    }
  }
  async function getPatientAmrsEncounterDiagnosis() {
    setEncounterDiagnosisLoading(true);
    const amrsMaternityDiagnosisPayload = getPatientAmrsVisitDiagnosisPayload();
    try {
      const resp: any = await fetchPatientEncounterDiagnosis(amrsMaternityDiagnosisPayload);
      const results = (resp ?? []).filter((r) => r?.uuid != null && r?.dx_rank === 1).map((v) => ({ ...v }));
      setEncounterDiagnosis(results);
    } catch (error) {
      showSnackbar({
        title: 'Error fetching patient encounter diagnosis',
        kind: 'error',
        subtitle: 'An error occurred while fetching the patient encounter diagnosis',
      });
    } finally {
      setEncounterDiagnosisLoading(false);
    }
  }
  function getPatientAmrsVisitDiagnosisPayload(): AmrsVisitDiagnosisDto {
    return {
      patientUuid: patientUuid,
      visitDate: billingDate,
      locationUuid: locationUuid,
    };
  }
  function getPatientAmrsMaternityDiagnosisPayload(): AmrsMaternityDiagnosisDto {
    return {
      patientUuid: patientUuid,
      billingDate: billingDate,
    };
  }

  return (
    <>
    <div className={styles.visitDetailsLayout}>
      <RadioButtonGroup 
        name="patient-visits" 
        onChange={handVisitTypeChange} 
        defaultSelected={selectedVisitUuid}
        >
        {patientVisits &&
          patientVisits?.map((v) => {
            return (
                <RadioButton
                  id={v.visit_uuid}
                  labelText={`${v.visit_type}: ${v.date_started}`}
                  value={v.visit_uuid}
                />
            );
          })}
      </RadioButtonGroup>
      {selectedVisitUuid && (
        <Tabs>
          <TabList scrollDebounceWait={200}>
            <Tab>Bill Details</Tab>
            <Tab>Claim</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              {patientBillDetails && (
                <BillDetails
                  patientBillDetails={patientBillDetails}
                  patientPayments={patientBillPayments}
                  amrsVisitDiagnosis={patientAmrsVisitDiagnosis}
                  locationUuid={locationUuid}
                  consentToken={consentToken}
                  claimsVisit={claimsVisit}
                />
              )}
            </TabPanel>
            <TabPanel>
              {locationUuid && consentToken ? (
                <PatientClaimDetails
                  locationUuid={locationUuid}
                  patientBillDetails={patientBillDetails}
                  consentToken={consentToken ?? ''}
                  onBillDetailsChange={()=>getPatientBillDetails(selectedVisitUuid)}
                  billingDate={billingDate}
                  onLoadingClaimVisit={onLoadingClaimVisit}
                />
              ) : (
                <></>
              )}
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}
      </div>
    </>
  );
};

export default PatientVisitDetailsComponent;
