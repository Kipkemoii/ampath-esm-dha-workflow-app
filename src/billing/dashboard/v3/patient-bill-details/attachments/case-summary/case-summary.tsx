import React, { forwardRef, useEffect, useState } from 'react';
import styles from './case-summary.scss';
import { fetchCaseSummary } from '../../../../../billing-claims.resource';
import { showSnackbar, useSession } from '@openmrs/esm-framework';
import { type VisitSummaryResponse, type VitalReading } from '../type';
import { normalizeVitals } from './case-summary-helper';

const TREND_GLYPH = { up: '↑', down: '↓', flat: '→' };

function Field({ label, value }) {
  return (
    <div className={styles['cs-field']}>
      <div className={styles['cs-field-label']}>{label}</div>
      <div className={styles['cs-field-value']}>{value}</div>
    </div>
  );
}

function SectionBlock({ number, title, children }) {
  return (
    <section className={styles['cs-section']}>
      <h2 className={styles['cs-section-title']}>
        {number && <span className={styles['cs-section-num']}>{number}</span>} {title}
      </h2>
      <div className={styles['cs-section-body']}>{children}</div>
    </section>
  );
}

interface CaseSummaryProps {
  patientUuid: string;
}

const CaseSummary = forwardRef<HTMLDivElement, CaseSummaryProps>(({ patientUuid }, ref) => {
  const [caseSummary, setCasesummary] = useState<VisitSummaryResponse>();
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

  const getCaseSummary = async (locationUuid: string) => {
    try {
      const res: VisitSummaryResponse = await fetchCaseSummary(locationUuid!, patientUuid);
      setCasesummary(res);
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
    getCaseSummary(locationUuid);
  }, [locationUuid, session]);

  return (
    <div className={styles['cs-root']} ref={ref}>
      <div className={styles['cs-shell']}>
        <header className={styles['cs-header']}>
          <div className={styles['cs-header-bar']} />
          <div className={styles['cs-header-info']}>
            <p className={styles['cs-org']}>{locationName}</p>
            <h1 className={styles['cs-title']}>Patient Clinical Summary</h1>
          </div>
          <div className={styles['cs-meta-right']}>
            Printed by {user}
            <br />
            {formatDate()}
          </div>
        </header>

        <div className={styles['cs-identity']}>
          <div className={styles['cs-field']}>
            <div className={styles['cs-field-label']}>Patient Name</div>
            <div className={`${styles['cs-field-value']} ${styles['cs-name-value']}`}>
              {caseSummary?.demographics.name}
            </div>
          </div>
          <Field label="DOB" value={caseSummary?.demographics.birthDate} />
          <Field
            label="Age / Gender"
            value={`${caseSummary?.demographics.age}y · ${caseSummary?.demographics.gender}`}
          />
          <Field label="Patient ID" value={caseSummary?.demographics.patientId} />
          <Field label="National ID" value={caseSummary?.demographics.nationalId} />
          <Field label="CR Identifier." value={caseSummary?.demographics.crNumber} />
        </div>

        {/* {p.alert && <div className={styles['cs-alert']}>{p.alert}</div>} */}

        <SectionBlock number="1" title="Allergies">
          {caseSummary?.allergies.map((a, i) => (
            <div key={i} className={styles['cs-field-value']}>
              ✓ {a.label}
            </div>
          ))}
        </SectionBlock>

        <SectionBlock number="2" title="Active Diagnoses">
          <table className={styles['cs-table']}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Code</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {caseSummary?.conditions.map((d, i) => (
                <tr key={i}>
                  <td>{formatDate(d.onsetDate)}</td>
                  <td>{d.code}</td>
                  <td>
                    {d.description}
                    {d.primary && <span className={styles['cs-pill']}>Primary</span>}
                  </td>
                  <td>{d.certainty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionBlock>

        <SectionBlock number="3" title="Latest Vitals">
          <div className={styles['cs-vitals-grid']}>
            {vitals?.map((v, i) => (
              <div className={styles['cs-vital']} key={i}>
                <div className={styles['cs-vital-value']}>
                  {v.value}
                  <span className={styles['cs-vital-unit']}> {v.unit}</span>
                </div>
                <div className={styles['cs-vital-label']}>
                  {v.label} <span className={styles['cs-vital-trend']}></span>
                </div>
              </div>
            ))}
          </div>
          <div className={styles['cs-vitals-foot']}>
            <span>Taken: {''}</span>
            <span>TEW Score: {''}</span>
          </div>
        </SectionBlock>

        <SectionBlock number="4" title="Active Medications">
          <table className={styles['cs-table']}>
            <thead>
              <tr>
                <th>Drug</th>
                <th>Dose</th>
                <th>Route</th>
                <th>Frequency</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {caseSummary?.medications.map((m, i) => (
                <tr key={i}>
                  <td>
                    <div className={styles['cs-drug-name']}>
                      {m.drug}
                      {m.tag && <span className={styles['cs-pill']}> {m.tag}</span>}
                    </div>
                    <div className={styles['cs-drug-detail']}>{m.detail}</div>
                  </td>
                  <td>{m.dose}</td>
                  <td>{m.route}</td>
                  <td>{m.frequency}</td>
                  <td>{m.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionBlock>

        <SectionBlock number="5" title="Latest Lab Results">
          {caseSummary?.labOrders.length === 0 ? (
            <div className={styles['cs-empty']}>No lab results available</div>
          ) : (
            <table className={styles['cs-table']}>
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Order Date</th>
                  <th>Pending</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {caseSummary?.labOrders.map((m, i) => (
                  <tr key={i}>
                    <td>
                      <div className={styles['cs-drug-name']}>{m.test}</div>
                    </td>
                    <td>{formatDate(m.orderedDate)}</td>
                    <td>{m.pending}</td>
                    <td>{m.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionBlock>

        <SectionBlock number="6" title={`SOAP Note`}>
          <dl className={styles['cs-soap']}>
            <dt>Subjective</dt>
            <dd>{caseSummary?.soapNote.subjective}</dd>
            <dt>Objective</dt>
            <dd>{caseSummary?.soapNote.objective}</dd>
            <dt>Assessment</dt>
            <dd>{caseSummary?.soapNote.assessment}</dd>
            <dt>Plan</dt>
            <dd>{caseSummary?.soapNote.plan}</dd>
          </dl>
        </SectionBlock>

        <SectionBlock number="7" title="Admission Details">
          <div className={styles['cs-field-grid']}>
            <Field label="Status" value={caseSummary?.admissionDetails?.status} />
            <Field label="Admission Date" value={formatDate(caseSummary?.admissionDetails?.admissionDate)} />
            <Field label="Admission Diagnosis" value={caseSummary?.admissionDetails?.diagnosis} />
            <Field label="Primary Doctor" value={caseSummary?.admissionDetails?.admittingDoctor} />
            <Field label="Ward / Bed" value={caseSummary?.admissionDetails?.ward} />
          </div>
        </SectionBlock>

        {/* <SectionBlock number="8" title="Encounter Log">
          {p.encounters.map((e, i) => (
            <div className={styles['cs-encounter']} key={i}>
              <div className={styles['cs-encounter-head']}>
                {e.date} — {e.time} — {e.clinician}
              </div>
              {e.labOrders && (
                <div className={styles['cs-encounter-line']}>
                  <b>Lab Orders:</b> {e.labOrders}
                </div>
              )}
              {e.prescriptions && (
                <div className={styles['cs-encounter-line']}>
                  <b>Prescriptions:</b> {e.prescriptions}
                </div>
              )}
            </div>
          ))}
        </SectionBlock> */}

        <div className={styles['cs-footer']}>Confidential — For authorized clinical use only</div>
      </div>
    </div>
  );
});

CaseSummary.displayName = 'CaseSummary';

export default CaseSummary;
