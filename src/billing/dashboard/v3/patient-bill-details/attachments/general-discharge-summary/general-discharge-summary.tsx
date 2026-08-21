import React, { forwardRef, useEffect, useState } from 'react';
import styles from './general-discharge-summary.scss';
import { showSnackbar, useSession } from '@openmrs/esm-framework';
import { type VisitSummaryResponse, type VitalReading } from '../type';
import { normalizeVitals } from '../case-summary/case-summary-helper';
import { fetchCaseSummary } from '../../../../../billing-claims.resource';

const DEMO_SUMMARY = {
  facility: 'Sample Sub County Hospital',
  patient: {
    name: 'John A. Sample',
    patientId: 'SAMPLE-ID-0000000',
    dob: '01-01-1990',
    gender: 'Male',
    nationalId: '00000000',
    hospitalNo: 'SAMPLE-ID-0000000',
    insuranceNo: '00000000',
    mobile: '+254700000000',
  },
  admission: {
    admissionDate: '01-01-2026 00:00:00',
    dischargeDate: '03-01-2026',
    status: 'Discharged',
    primaryDoctor: 'Dr. Sample Physician',
    ward: 'WARD-00 - Sample Ward',
    admissionDiagnosis: 'Sample admission diagnosis, unspecified',
    inpatientRecord: 'SAMPLE-INP-000000-000000-0000-0000',
  },
  clinical: {
    dischargeDiagnosis: 'Sample discharge diagnosis, unspecified',
    otherConditions: 'None',
    findings: 'Sample clinical findings as documented.',
    treatment: 'Sample treatment summary.',
    operations: 'None',
    labFindings: 'Sample lab panel',
    imagingFindings: 'None',
    referrals: 'None',
  },
  outcome: {
    condition: 'stable condition',
    attendingDoctor: 'Dr. Sample Physician',
  },
  medications: [
    {
      drug: 'SAMPLE DRUG 500 MG',
      dose: '1',
      period: '5 Day',
      notes: '(1) SAMPLE DRUG 500 MG BID for 5 Day Oral',
    },
    {
      drug: 'SAMPLE IV MEDICATION 1000 MG',
      dose: '1',
      period: '3 Day',
      notes: '(1) SAMPLE IV MEDICATION 1000 MG BID for 3 Day IV',
    },
  ],
  printedBy: 'Demo User',
  printedAt: '2026-01-03 00:00:00',
};

function Field({ label, value }) {
  return (
    <div className={styles['ds-field']}>
      <div className={styles['ds-field-label']}>{label}</div>
      <div className={styles['ds-field-value']}>{value}</div>
    </div>
  );
}

function SectionBlock({ number, title, children }) {
  return (
    <section className={styles['ds-section']}>
      <h2 className={styles['ds-section-title']}>
        {number && <span className={styles['ds-section-num']}>{number}</span>} {title}
      </h2>
      <div className={styles['ds-section-body']}>{children}</div>
    </section>
  );
}

interface GeneralDischargeSummaryProps {
  summary?: typeof DEMO_SUMMARY;
  patientUuid: string;
}

const GeneralDischargeSummary = forwardRef<HTMLDivElement, GeneralDischargeSummaryProps>(
  ({ summary = DEMO_SUMMARY, patientUuid }, ref) => {
    const s = summary;
    const [dischargeSummary, setDischargeSummary] = useState<VisitSummaryResponse>();
    const [vitals, setVitals] = useState<VitalReading[]>();
    const session = useSession();
    const locationUuid = session?.sessionLocation?.uuid;
    const locationName = session?.sessionLocation?.display;
    const user = session?.user?.display;
    const formatDate = (date?: string | Date | null): string => {
      if (!date) return '—';

      return new Intl.DateTimeFormat('en-KE', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }).format(new Date(date));
    };

    const getDischargeSummary = async (locationUuid: string) => {
      try {
        const res: VisitSummaryResponse = await fetchCaseSummary(locationUuid!, patientUuid);
        setDischargeSummary(res);
        const normalizedVitals = normalizeVitals(res.vitals);
        setVitals(normalizedVitals);
      } catch (err) {
        console.log(err);
        showSnackbar({
          kind: 'error',
          title: 'An error occured while fetching Case summary',
          subtitle: 'An error occured while fetching Case summary. Please try again!',
        });
      }
    };

    useEffect(() => {
      if (!locationUuid) return;
      getDischargeSummary(locationUuid);
    }, [locationUuid, session]);

    return (
      <div className={styles['ds-root']} ref={ref}>
        <div className={styles['ds-shell']}>
          <header className={styles['ds-header']}>
            <div className={styles['ds-header-bar']} />
            <div className={styles['ds-header-info']}>
              <p className={styles['ds-org']}>{locationName}</p>
              <h1 className={styles['ds-title']}>Discharge Summary</h1>
            </div>
            <div className={styles['ds-meta-right']}>
              Printed by {user}
              <br />
              {formatDate()}
            </div>
          </header>

          <SectionBlock number="1" title="Patient Information">
            <div className={styles['ds-field-grid']}>
              <Field label="Patient Name" value={dischargeSummary?.demographics?.name} />
              <Field label="Patient ID" value={dischargeSummary?.demographics?.patientId} />
              <Field label="Date of Birth" value={dischargeSummary?.demographics?.birthDate} />
              <Field label="Gender" value={s.patient.gender} />
              <Field label="National ID" value={dischargeSummary?.demographics?.nationalId} />
              <Field label="Hospital No" value={dischargeSummary?.demographics?.crNumber} />
              <Field label="Insurance No" value={dischargeSummary?.demographics?.crNumber} />
              <Field label="Mobile" value={dischargeSummary?.demographics?.contact} />
            </div>
          </SectionBlock>

          <SectionBlock number="2" title="Admission Details">
            <div className={styles['ds-field-grid']}>
              <Field label="Admission Date" value={dischargeSummary?.inpatientDetails?.admissionDate} />
              <Field label="Discharge Date" value={dischargeSummary?.inpatientDetails?.dischargeDate} />
              <Field label="Status" value={dischargeSummary?.inpatientDetails?.status} />
              <Field label="Primary Doctor" value={dischargeSummary?.inpatientDetails?.admittingDoctor} />
              <Field label="Ward / Bed" value={dischargeSummary?.inpatientDetails?.ward} />
              <Field label="Admission Diagnosis" value={dischargeSummary?.inpatientDetails?.diagnosis} />
              <Field label="Inpatient Record" value={dischargeSummary?.inpatientDetails?.admissionReason} />
            </div>
          </SectionBlock>

          <SectionBlock number="3" title="Medical Data">
            <div className={styles['ds-field-grid']}>
              <Field label="Discharge Diagnosis" value={dischargeSummary?.inpatientDetails?.diagnosis} />
              <Field label="Other Conditions" value={dischargeSummary?.inpatientDetails?.otherConditions} />
              {/* <Field label="Clinical Findings" value={s.clinical.findings} />
              <Field label="Treatment" value={s.clinical.treatment} />
              <Field label="Operations / Procedures" value={s.clinical.operations} /> */}
              {dischargeSummary?.labOrders ? (
                <Field label="Laboratory Findings" value={dischargeSummary?.labOrders?.map((o, i) => o.test)} />
              ) : (
                <></>
              )}
              {/* <Field label="Imaging Findings" value={s.clinical.imagingFindings} /> */}
              <Field
                label="Referrals / Other Instructions"
                value={dischargeSummary?.inpatientDetails?.referringFacility}
              />
            </div>
          </SectionBlock>

          <SectionBlock number="4" title="Medications Prescribed During Admission">
            <table className={styles['ds-table']}>
              <thead>
                <tr>
                  <th>Admission Date</th>
                  <th>Ward</th>
                  <th>Bed</th>
                  <th>Drug</th>
                  <th>Status</th>
                  <th>Doctor</th>
                </tr>
              </thead>

              <tbody>
                {dischargeSummary?.inpatientDetails && (
                  <table className={styles['ds-table']}>
                    <tbody>
                      <tr>
                        <td>Admission Date</td>
                        <td>{dischargeSummary?.inpatientDetails?.admissionDate ?? '—'}</td>
                      </tr>

                      <tr>
                        <td>Ward</td>
                        <td>{dischargeSummary?.inpatientDetails?.ward ?? '—'}</td>
                      </tr>

                      <tr>
                        <td>Bed</td>
                        <td>{dischargeSummary?.inpatientDetails?.bed ?? '—'}</td>
                      </tr>
                      <tr>
                        <td>Diagnosis</td>
                        <td>{dischargeSummary?.inpatientDetails?.diagnosis ?? '—'}</td>
                      </tr>
                      <tr>
                        <td>Diagnosis</td>
                        <td>{dischargeSummary?.inpatientDetails?.status ?? '—'}</td>
                      </tr>
                      <tr>
                        <td>Admitting Doctor</td>
                        <td>{dischargeSummary?.inpatientDetails?.admittingDoctor ?? '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </tbody>
            </table>
          </SectionBlock>

          <SectionBlock number="5" title="Post-Discharge Instructions">
            <div className={styles['ds-outcome']}>
              Patient discharged in <strong>{dischargeSummary?.inpatientDetails?.status}</strong>.
            </div>
            <Field label="Attending Doctor" value={dischargeSummary?.inpatientDetails?.admittingDoctor} />
          </SectionBlock>

          <div className={styles['ds-footer']}>Confidential — For authorized clinical use only</div>
        </div>
      </div>
    );
  },
);

GeneralDischargeSummary.displayName = 'GeneralDischargeSummary';

export default GeneralDischargeSummary;
