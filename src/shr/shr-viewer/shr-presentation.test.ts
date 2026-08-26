import { buildRows, columnsFor, statusColumnFor } from './shr-presentation';
import type { ShrObservation } from '../shr.types';

/**
 * Fixtures trimmed from a real SHR `patient-records` response: a `vital-signs`
 * Observation, an `exam` (secondary-survey) Observation, and one Observation
 * with no `category` at all, to make sure the three never collide.
 */
const systolicBp: ShrObservation = {
  resourceType: 'Observation',
  id: '0b6306fc-ccd4-444f-bb8b-64e59aa8ce1e',
  status: 'final',
  category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
  code: { coding: [{ system: 'https://nshr-uat.sha.go.ke/fhir/CodeSystem/em-vital-signs-loinc-cs', code: '8480-6' }] },
  effectiveDateTime: '2026-08-03T13:07:17.270302+03:00',
  valueQuantity: { value: 120, unit: 'mmHg', code: 'mm[Hg]' },
};

const rigidityFinding: ShrObservation = {
  resourceType: 'Observation',
  id: '3e33b28a-1c61-4472-8bb0-d7c00d1462d5',
  status: 'final',
  category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'exam' }] }],
  code: { coding: [{ system: 'https://nshr-uat.sha.go.ke/fhir/CodeSystem/em-secondary-survey-region', code: 'XA55T2' }] },
  bodySite: { coding: [{ system: 'https://nshr-uat.sha.go.ke/fhir/CodeSystem/em-body-region', code: 'XA55T2' }] },
  extension: [{ url: 'https://nshr-uat.sha.go.ke/fhir/StructureDefinition/em-no-findings-on-exam', valueBoolean: false }],
  effectiveDateTime: '2026-08-03T13:07:44.370538+03:00',
  valueCodeableConcept: { coding: [{ system: 'https://nshr-uat.sha.go.ke/fhir/CodeSystem/em-body-assessment-finding', code: 'rigidity' }] },
};

const noFindingsExam: ShrObservation = {
  resourceType: 'Observation',
  id: '8a320cfc-d4e9-4602-a1df-1229d9565be4',
  status: 'final',
  category: [{ coding: [{ code: 'exam' }] }],
  bodySite: { coding: [{ code: 'XA45A6' }] },
  extension: [{ url: 'https://nshr-uat.sha.go.ke/fhir/StructureDefinition/em-no-findings-on-exam', valueBoolean: true }],
  effectiveDateTime: '2026-08-03T13:07:44.370538+03:00',
};

const genuineLabResult: ShrObservation = {
  resourceType: 'Observation',
  id: 'lab-1',
  status: 'final',
  code: { coding: [{ display: 'Malaria RDT' }] },
  valueCodeableConcept: { coding: [{ display: 'Negative' }] },
  effectiveDateTime: '2026-08-03T13:07:44.370538+03:00',
};

describe('vitals presentation (Observation + categoryCode "vital-signs")', () => {
  it('has the expected columns, and falls back to the raw LOINC code when it has not been resolved', () => {
    // The plain-language name (e.g. "Systolic blood pressure") comes from
    // `shr-terminology.resource`'s live lookup against the coding's own
    // `system` — see shr-terminology.resource.test.ts for that resolution
    // actually happening. Nothing primes the cache here, so this only checks
    // the fallback this presenter shows while unresolved.
    const headers = columnsFor('Observation', 'vital-signs').map((h) => h.header);
    expect(headers).toEqual(['Vital sign', 'Reading', 'Status', 'Recorded']);

    const [row] = buildRows('Observation', [systolicBp], 'vital-signs');
    expect(row.cells.vitalSign).toBe('8480-6');
    expect(row.cells.result).toBe('120 mmHg');
  });

  it('has its own status column, distinct from the generic Observation presenter', () => {
    expect(statusColumnFor('Observation', 'vital-signs')).toBe('status');
  });
});

describe('exam findings presentation (Observation + categoryCode "exam")', () => {
  it('falls back to the raw body-region code and humanises the finding when unresolved', () => {
    // See the "has the expected columns..." vitals test above — same fallback
    // story, and shr-terminology.resource.test.ts for the resolved case.
    const [row] = buildRows('Observation', [rigidityFinding], 'exam');
    expect(row.cells.bodyRegion).toBe('XA55T2');
    expect(row.cells.finding).toBe('Rigidity');
  });

  it('reports "No findings" when the no-findings-on-exam extension is set', () => {
    const [row] = buildRows('Observation', [noFindingsExam], 'exam');
    expect(row.cells.finding).toBe('No findings');
  });
});

describe('generic Observation presentation (the "Lab results" catch-all, no categoryCode)', () => {
  it('is unaffected and keeps the original Test/Result columns', () => {
    const headers = columnsFor('Observation').map((h) => h.header);
    expect(headers).toEqual(['Test', 'Result', 'Status', 'Date']);

    const [row] = buildRows('Observation', [genuineLabResult]);
    expect(row.cells.test).toBe('Malaria RDT');
    expect(row.cells.result).toBe('Negative');
  });
});
