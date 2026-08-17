import React, { useEffect, useMemo, useState } from 'react';
import styles from './patient-bill-details.scss';
import {
  type PatientFacilityBillsDto,
  type PatientFacilityBillDetails,
  type PatientPaymentsDto,
  type PatientPayment,
  ClaimsVisit,
} from '../types';
import {
  fetchMaternityDiagnosis,
  fetchPatientBillPayments,
  fetchPatientDiagnosis,
  fetchPatientEncounterDiagnosis,
  fetchPatientFacilityBillDetails,
} from '../../../billing-claims.resource';
import { showSnackbar } from '@openmrs/esm-styleguide';
import {
  Column,
  Grid,
  RadioButton,
  RadioButtonGroup,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  Tile,
} from '@carbon/react';
import BillDetails from './bill-details/bill-details';
import PatientClaimDetails from './claim-details/patient-claim-details.component';
import { type AmrsVisitDiagnosisDto, type AmrsVisitDiagnosis, type AmrsMaternityDiagnosisDto } from '../../../types';
import { resolveConsentTokenFromBillLines } from '../../v2/patient-bill-details/payment-mode';
interface patientBillDetailsProps {
  patientUuid: string;
  locationUuid: string;
  billingDate: string;
}
const PatientBillDetails: React.FC<patientBillDetailsProps> = ({ patientUuid, locationUuid, billingDate }) => {
  const [patientBillDetails, setPatientBillDetails] = useState<PatientFacilityBillDetails[]>([]);
  const [consentToken, setConsentToken] = useState<string>('');
  const [patientBillPayments, setPatientBillPayments] = useState<PatientPayment[]>([]);
  const [visitType, setVisitType] = useState('opd');
  const showVisitTabs = visitType === 'opd' || visitType === 'inpatient';
  const facilityPatientDetail = useMemo(() => {
    return patientBillDetails[0] ?? null;
  }, [patientBillDetails]);
  const billStatus = useMemo(() => getBillStatus(patientBillDetails), [patientBillDetails]);
  const billTotalAmount = useMemo(
    () => patientBillDetails.reduce((sum, item) => sum + Number(item.item_total_price ?? 0), 0),
    [patientBillDetails],
  );
  const billPaidAmount = useMemo(
    () => patientBillPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
    [patientBillPayments],
  );
  const billBalance = useMemo(() => Math.max(0, billTotalAmount - billPaidAmount), [billTotalAmount, billPaidAmount]);
  const amountClaimed = useMemo(
    () =>
      patientBillDetails
        .filter((item) => Boolean(item.intervention_code?.trim()))
        .reduce((sum, item) => sum + Number(item.item_total_price ?? 0), 0),
    [patientBillDetails],
  );
  const [visitDiagnosis, setVisitDiagnosis] = useState<AmrsVisitDiagnosis[]>([]);
  const [maternityDiagnosis, setMaternityDiagnosis] = useState<AmrsVisitDiagnosis[]>([]);
  const [encounterDiagnosis, setEncounterDiagnosis] = useState<AmrsVisitDiagnosis[]>([]);
  const patientAmrsVisitDiagnosis = useMemo(
    () => [...visitDiagnosis, ...maternityDiagnosis, ...encounterDiagnosis],
    [visitDiagnosis, maternityDiagnosis, encounterDiagnosis],
  );
  const [claimsVisit, setClaimsVisit] = useState<ClaimsVisit>();

  const [visitDiagnosisLoading, setVisitDiagnosisLoading] = useState<boolean>(true);
  const [maternityDiagnosisLoading, setMaternityDiagnosisLoading] = useState<boolean>(true);
  const [encounterDiagnosisLoading, setEncounterDiagnosisLoading] = useState<boolean>(true);
  const diagnosisLoading = visitDiagnosisLoading || maternityDiagnosisLoading || encounterDiagnosisLoading;

  useEffect(() => {
    if (locationUuid && patientUuid && billingDate) {
      getPatientBillDetails();
      getPatientPayments();
      getPatientAmrsVisitDiagnosis();
      getPatientAmrsMaternityDiagnosis();
      getPatientAmrsEncounterDiagnosis();
    }
  }, [locationUuid, patientUuid, billingDate]);
  async function getPatientBillDetails() {
    const patientBillPayload = generatePatientBillPayload();
    try {
      const data = await fetchPatientFacilityBillDetails(patientBillPayload);
      if (data) {
        setPatientBillDetails(data);
        setConsentToken(resolveConsentTokenFromBillLines(data));
      }
    } catch (error) {
      showSnackbar({
        title: 'Error fetching patient bill details',
        kind: 'error',
        subtitle: 'An error occurred while generat',
      });
    }
  }
  function generatePatientBillPayload(): PatientFacilityBillsDto {
    return {
      locationUuid: locationUuid,
      billingDate: billingDate,
      patientUuid: patientUuid,
    };
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
  function getBillStatus(patientBillDetails: PatientFacilityBillDetails[]) {
    if (patientBillDetails.length > 0) {
      const hasPostedBill = patientBillDetails.some((s) => {
        return s.paid_status === 'POSTED';
      });
      if (hasPostedBill) {
        return 'PARTIALLY PAID';
      }
      const hasPendingBill = patientBillDetails.some((s) => {
        return s.paid_status === 'PENDING';
      });
      if (hasPendingBill) {
        return 'PENDING';
      }
      return 'PAID';
    } else {
      return status;
    }
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
      const results = (resp ?? []).filter((r) => r?.uuid != null).map((v) => ({ ...v }));
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
  function onLoadingClaimVisit(claimVisit: ClaimsVisit) {
    if (claimVisit) {
      setClaimsVisit(claimVisit);
    }
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }

  function getBillStatusTagType(status: string) {
    if (status === 'PAID') {
      return 'green';
    }
    if (status === 'PENDING') {
      return 'red';
    }
    return 'cool-gray';
  }

  return (
    <>
      <div className={styles.bdLayout}>
        <Grid condensed className={styles.summaryGrid}>
          <Column sm={4} md={5} lg={10} className={styles.summaryColumn}>
            <Tile className={styles.summaryTile}>
              <h6 className={styles.summaryHeading}>Bill details</h6>
              {facilityPatientDetail ? (
                <Grid condensed className={styles.patientSummaryGrid}>
                  <Column sm={4} md={4} lg={8} className={styles.pdCol}>
                    <span className={styles.fieldLabel}>Name</span>
                    <span>{facilityPatientDetail.patient_name}</span>
                  </Column>
                  <Column sm={4} md={4} lg={8} className={styles.pdCol}>
                    <span className={styles.fieldLabel}>CR</span>
                    <span>{facilityPatientDetail.cr_no}</span>
                  </Column>
                  <Column sm={4} md={4} lg={8} className={styles.pdCol}>
                    <span className={styles.fieldLabel}>Bill date</span>
                    <span>{facilityPatientDetail.bill_date}</span>
                  </Column>
                  <Column sm={4} md={4} lg={8} className={styles.pdCol}>
                    <span className={styles.fieldLabel}>CashPoint</span>
                    <span>{facilityPatientDetail.cash_point}</span>
                  </Column>
                </Grid>
              ) : null}
            </Tile>
          </Column>
          <Column sm={4} md={3} lg={6} className={styles.summaryColumn}>
            <Tile className={styles.summaryTile}>
              <h6 className={styles.summaryHeading}>Bill status</h6>
              <div className={styles.statusTagRow}>
                <Tag type={getBillStatusTagType(billStatus)}>{billStatus ?? ''}</Tag>
              </div>
              <StructuredListWrapper className={styles.amountList} isCondensed>
                <StructuredListBody>
                  <StructuredListRow className={styles.amountRow}>
                    <StructuredListCell className={styles.fieldLabel}>Total amount</StructuredListCell>
                    <StructuredListCell className={styles.amountValue}>
                      Ksh {formatCurrency(billTotalAmount)}
                    </StructuredListCell>
                  </StructuredListRow>
                  {amountClaimed > 0 && (
                    <StructuredListRow className={styles.amountRow}>
                      <StructuredListCell className={styles.fieldLabel}>Claim amount</StructuredListCell>
                      <StructuredListCell className={styles.amountValue}>
                        Ksh {formatCurrency(amountClaimed)}
                      </StructuredListCell>
                    </StructuredListRow>
                  )}
                  <StructuredListRow className={styles.amountRow}>
                    <StructuredListCell className={styles.fieldLabel}>Amount paid</StructuredListCell>
                    <StructuredListCell className={styles.amountValue}>
                      Ksh {formatCurrency(billPaidAmount)}
                    </StructuredListCell>
                  </StructuredListRow>
                  <StructuredListRow className={styles.balanceRow}>
                    <StructuredListCell className={styles.balanceLabel}>Balance</StructuredListCell>
                    <StructuredListCell className={styles.balanceValue}>
                      Ksh {formatCurrency(billBalance)}
                    </StructuredListCell>
                  </StructuredListRow>
                </StructuredListBody>
              </StructuredListWrapper>
            </Tile>
          </Column>
        </Grid>
        <div>
          <RadioButtonGroup
            name="care setting"
            valueSelected={visitType}
            onChange={(value) => setVisitType(String(value ?? 'opd'))}
          >
            <RadioButton id="opd" labelText="OPD" value="opd" />
            <RadioButton id="inpatient" labelText="INPATIENT" value="inpatient" />
          </RadioButtonGroup>
        </div>

        {visitType && (
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
                    consentToken={consentToken}
                    onBillDetailsChange={getPatientBillDetails}
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

export default PatientBillDetails;
