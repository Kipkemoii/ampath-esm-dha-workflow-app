import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import styles from './dialysis-chart.scss';
import { type VisitSummaryResponse, type VitalReading } from '../type';
import { showSnackbar, useSession } from '@openmrs/esm-framework';
import { fetchCaseSummary } from '../../../../../billing-claims.resource';
import { normalizeVitals } from '../case-summary/case-summary-helper';
import { extractDialysisData } from './dialysis-helper';

const DEMO_SESSION = {
  facility: {
    name: 'Sample Renal Unit',
    hospital: 'Sample District Hospital',
    address: 'Sample Town, P.O. Box 000-00000, Sample Town',
    phone: '0700000000',
    email: 'info@samplehospital.example',
  },
  patient: {
    name: 'John A. Sample',
    opNo: '000000',
    insuranceNo: 'CR0000000000000-0',
    date: '01-Jan-2026',
    age: '60 years 0 months 0 weeks',
    sex: 'Male',
    contact: '0700000000',
    clinic: 'Renal Unit',
    diagnosis: 'Sample diagnosis code — Chronic kidney disease, stage 5',
    address: 'Sample Ward',
  },
  preAssessment: {
    weightBefore: '0.00 kg',
    temperature: '36.5 °C',
    pulse: '0.00 bpm',
    bp: '0/0 mmHg',
    respRate: '0.00',
    oxygenSat: '0.00 %',
    bloodSugar: '0.0',
    accessType: 'Catheter',
    accessSite: 'cvc',
    doctor: 'Dr. Sample Nephrologist',
  },
  prescription: {
    dialyzerType: 'synthetic',
    bfr: '-',
    dfr: '0.00 ml/min',
    duration: '-',
    ufGoal: '0.00 L',
    heparinDose: '-',
    dialysateComposition: 'sodium bicarbonate',
  },
  monitoring: [
    { time: '0 min', bp: '0/0', pulse: '0', temp: '36.5', ufRemoved: '0', heparin: '0', remarks: 'pt is stable' },
    { time: '60 min', bp: '0/0', pulse: '0', temp: '36.5', ufRemoved: '0mls', heparin: '0iu', remarks: 'pt is stable' },
    {
      time: '120 min',
      bp: '0/0',
      pulse: '0',
      temp: '36.5',
      ufRemoved: '0mls',
      heparin: '0iu',
      remarks: 'pt is stable',
    },
    {
      time: '180 min',
      bp: '0/0',
      pulse: '0',
      temp: '36.5',
      ufRemoved: '0mls',
      heparin: '0iu',
      remarks: 'pt is stable',
    },
    {
      time: '240 min',
      bp: '0/0',
      pulse: '0',
      temp: '36.5',
      ufRemoved: '0mls',
      heparin: '0iu',
      remarks: 'pt is stable',
    },
  ],
  postAssessment: {
    weightAfter: '0.00 kg',
    totalUfAchieved: '-',
    bp: '0/0',
    pulse: '0.00 bpm',
    temperature: '36.5 °C',
    accessSite: 'Cleaned and dressed',
    condition: 'Stable',
    complications: 'None',
  },
  summary: {
    prescribedDuration: '-',
    actualDuration: '-',
    adequacyAchieved: 'Yes',
    toleratedProcedure: 'Yes',
    comments: 'Sample discharge comment.',
    nextSessionDate: '-',
    additionalRemarks: '',
  },
  signoff: {
    nurse: { name: 'Sample Nurse', regNo: '000000', date: '01-Jan-2026' },
    doctor: { name: 'Dr. Sample Nephrologist', regNo: 'A0000', date: '01-Jan-2026' },
  },
};

function Field({ label, value }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.fieldValue}>{value}</div>
    </div>
  );
}

function SectionBlock({ number, title, children }) {
  return (
    <section className={styles['dc-section']}>
      <h2 className={styles['dc-section-title']}>
        <span className={styles['dc-section-num']}>{number}</span> {title}
      </h2>
      <div className={styles['dc-section-body']}>{children}</div>
    </section>
  );
}

interface DialysisChartProps {
  session?: typeof DEMO_SESSION;
  patientUuid: string;
}

const DialysisChart = forwardRef<HTMLDivElement, DialysisChartProps>(({ session = DEMO_SESSION, patientUuid }, ref) => {
  const s = session;

  const [dialysisSummary, setDialysisSummary] = useState<VisitSummaryResponse>();
  const [vitals, setVitals] = useState<VitalReading[]>();
  // const p = patient;
  const sessionL = useSession();
  const locationUuid = sessionL?.sessionLocation?.uuid;
  const locationName = sessionL?.sessionLocation?.display;
  const user = sessionL?.user?.display;
  const formatDate = (date?: string | Date | null): string => {
    if (!date) return '—';

    return new Intl.DateTimeFormat('en-KE', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(new Date(date));
  };

  const getDialysisSummary = async (locationUuid: string) => {
    try {
      const res: VisitSummaryResponse = await fetchCaseSummary(locationUuid!, patientUuid);
      setDialysisSummary(res);
      const normalizedVitals = normalizeVitals(res.vitals);
      setVitals(normalizedVitals);
    } catch (err) {
      showSnackbar({
        kind: 'error',
        title: 'An error occured while fetching Case summary',
        subtitle: 'An error occured while fetching Case summary. Please try again!',
      });
    }
  };

  const extracted = useMemo(() => extractDialysisData(dialysisSummary?.clinicalNotes ?? []), [dialysisSummary]);

  useEffect(() => {
    if (!locationUuid) return;
    getDialysisSummary(locationUuid);
  }, [locationUuid, session]);

  return (
    <div className={styles['dc-root']} ref={ref}>
      <div className={styles['dc-shell']}>
        <header className={styles['dc-header']}>
          <div className={styles['dc-header-bar']} />
          <div className={styles['dc-header-info']}>
            <h1 className={styles['dc-title']}>Renal Unit Haemodialysis Notes</h1>
            <p className={styles['dc-hospital']}>{locationName}</p>
            <p className={styles['dc-hospital-meta']}>
              {/* {s.facility.address} · Tel: {s.facility.phone} · {s.facility.email} */}
            </p>
          </div>
        </header>

        <div className={styles['dc-identity']}>
          <Field label="Patient Name" value={dialysisSummary?.demographics.name} />
          <Field label="OP No" value={''} />
          <Field label="Insurance No" value={dialysisSummary?.demographics.crNumber} />
          <Field label="Date" value={dialysisSummary?.demographics.birthDate} />
          <Field label="Age" value={dialysisSummary?.demographics.age} />
          <Field label="Sex" value={dialysisSummary?.demographics.gender} />
          <Field label="Contact" value={dialysisSummary?.demographics.contact} />
          <Field label="Clinic" value={dialysisSummary?.demographics.clinic} />
          <Field label="Diagnosis" value={dialysisSummary?.demographics.diagnosis} />
          <Field label="Address" value={dialysisSummary?.demographics.address} />
        </div>

        <SectionBlock number="1" title="Pre-Dialysis Assessment">
          <div className={styles['dc-field-grid']}>
            <Field label="Weight Before" value={''} />
            <Field label="Temperature" value={dialysisSummary?.vitals?.temperature} />
            <Field label="Pulse" value={dialysisSummary?.vitals?.pulse} />
            <Field label="BP" value={dialysisSummary?.vitals?.bloodPressure} />
            <Field label="Resp. Rate" value={dialysisSummary?.vitals?.respiratoryRate} />
            <Field label="Oxygen Sat." value={dialysisSummary?.vitals?.spo2} />
            <Field label="Blood Sugar" value={''} />
            <Field label="Access Type" value={extracted?.preAssessment?.accessType} />
            <Field label="Access Site" value={''} />
            <Field label="Notes" value={extracted?.preAssessment?.notes} />
            <Field label="Doctor/Nephrologist" value={''} />
          </div>
        </SectionBlock>

        <SectionBlock number="2" title="Physician Prescription">
          {/* <div className={styles['dc-field-grid']}>
            <Field label="Dialyzer Type" value={s.prescription.dialyzerType} />
            <Field label="BFR" value={s.prescription.bfr} />
            <Field label="DFR" value={s.prescription.dfr} />
            <Field label="Duration" value={s.prescription.duration} />
            <Field label="UF Goal" value={s.prescription.ufGoal} />
            <Field label="Heparin Dose" value={s.prescription.heparinDose} />
            <Field label="Dialysate Composition" value={s.prescription.dialysateComposition} />
          </div> */}
          <div className={styles['dc-table']}>
            <h4>Medications</h4>

            {dialysisSummary?.medications?.length ? (
              <table className={styles.medicationsTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Drug</th>
                    <th>Dose</th>
                    <th>Route</th>
                    <th>Frequency</th>
                    <th>Duration</th>
                  </tr>
                </thead>

                <tbody>
                  {dialysisSummary?.medications.map((medication, index) => (
                    <tr key={index}>
                      <td>{medication.date}</td>
                      <td>{medication.drug}</td>
                      <td>{medication.dose}</td>
                      <td>{medication.route}</td>
                      <td>{medication.frequency}</td>
                      <td>{medication.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.noMedications}>No medications prescribed</div>
            )}
          </div>
        </SectionBlock>

        <SectionBlock number="3" title="Intra-Dialytic Monitoring — Record Observations Every 60 Minutes">
          <table className={styles['dc-table']}>
            <thead>
              <tr>
                <th>Time</th>
                <th>UF Removed</th>
                <th>Heparin</th>
                <th>Remarks</th>
                <th>BP</th>
                <th>Pulse</th>
                <th>Temp</th>
              </tr>
            </thead>
            <tbody>
              {extracted?.monitoring?.map((row, i) => (
                <tr key={i}>
                  <td>{row.time}</td>
                  <td>{row.ufRemoved}</td>
                  <td>{row.heparin}</td>
                  <td>{row.remarks}</td>
                  <td>{''}</td>
                  <td>{''}</td>
                  <td>{''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionBlock>

        <SectionBlock number="4" title="Post-Dialysis Assessment">
          <div className={styles['dc-field-grid']}>
            <Field label="Weight After" value={''} />
            <Field label="Total UF Achieved" value={extracted?.postAssessment.totalUfAchieved} />
            <Field label="BP" value={extracted?.postAssessment?.bloodPressure} />
            <Field label="Pulse" value={''} />
            <Field label="Temperature" value={extracted?.postAssessment?.temperature} />
            <Field label="Access Site" value={extracted?.postAssessment?.accessSite} />
            <Field label="Condition" value={extracted?.postAssessment?.condition} />
            <Field label="Complications" value={extracted?.postAssessment?.complications} />
          </div>
        </SectionBlock>

        <SectionBlock number="5" title="Dialysis Summary">
          {/* <div className={styles['dc-field-grid']}>
            <Field label="Prescribed Duration" value={s.summary.prescribedDuration} />
            <Field label="Actual Duration" value={s.summary.actualDuration} />
            <Field label="Adequacy Achieved" value={s.summary.adequacyAchieved} />
            <Field label="Tolerated Procedure" value={s.summary.toleratedProcedure} />
          </div> */}
          <div className={styles['dc-notes']}>
            <div className={styles['dc-field-label']}>Comments</div>
            <p className={styles['dc-note-text']}>{extracted?.postAssessment?.remarks}</p>
            <p className={styles['dc-note-text']}>Next dialysis date: {}</p>
          </div>
          <div className={styles['dc-notes']}>
            <div className={styles['dc-field-label']}>Additional Remarks / Emergency Instructions</div>
            <p className={styles['dc-note-text']}>
              {extracted?.postAssessment?.postDialysisRemarks || (
                <span className={styles['dc-empty']}>None recorded</span>
              )}
            </p>
          </div>
        </SectionBlock>

        <section className={styles['dc-signoff']}>
          {/* <div className={styles['dc-signoff-block']}>
            <div className={styles['dc-signoff-title']}>Dialysis Nurse</div>
            <Field label="Name" value={s.signoff.nurse.name} />
            <Field label="Reg. No" value={s.signoff.nurse.regNo} />
            <Field label="Date" value={s.signoff.nurse.date} />
            <div className={styles['dc-signature-line']} />
          </div>
          <div className={styles['dc-signoff-block']}>
            <div className={styles['dc-signoff-title']}>Doctor / Nephrologist</div>
            <Field label="Name" value={s.signoff.doctor.name} />
            <Field label="Reg. No" value={s.signoff.doctor.regNo} />
            <Field label="Date" value={s.signoff.doctor.date} />
            <div className={styles['dc-signature-line']} />
          </div> */}
          <div className={`${styles['dc-signoff-block']} ${styles['dc-signoff-stamp']}`}>
            <div className={styles['dc-signoff-title']}>Hospital Stamp</div>
            <div className={styles['dc-stamp-placeholder']}>stamp area</div>
          </div>
        </section>
      </div>
    </div>
  );
});

DialysisChart.displayName = 'DialysisChart';

export default DialysisChart;
