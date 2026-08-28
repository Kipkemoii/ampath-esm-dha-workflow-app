/**
 * Tests for bucketing SHR resources into viewer tabs — in particular that an
 * Observation category nobody configured is still shown, under its own name,
 * rather than folded into an unrelated tab.
 *
 * The category codes used here are the ones this SHR's own Observation profiles
 * actually fix: the standard `vital-signs`, `exam` and `survey`, plus
 * `caller-reported` from its site-specific `em-observation-category` system.
 */
import { buildCategories, categoryCodings, hasCategoryCode } from './shr-categories';
import type { ShrResourceTypeConfig } from '../../config-schema';
import type { ShrAnyResource } from '../shr.types';

const HL7_CATEGORY = 'http://terminology.hl7.org/CodeSystem/observation-category';
const SHA_CATEGORY = 'https://nshr-uat.sha.go.ke/fhir/CodeSystem/em-observation-category';

const UNCATEGORISED = { uncategorisedLabel: 'Uncategorised' };

/** The shipped default: three named Observation categories plus a catch-all. */
const configured: ShrResourceTypeConfig[] = [
  { resourceType: 'Encounter', label: 'Encounters' },
  { resourceType: 'Observation', label: 'Vitals', categoryCode: 'vital-signs' },
  { resourceType: 'Observation', label: 'Exam findings', categoryCode: 'exam' },
  { resourceType: 'Observation', label: 'Lab results', categoryCode: 'laboratory' },
  { resourceType: 'Observation', label: 'Other observations' },
];

function observation(id: string, category?: { system: string; code: string; display?: string }): ShrAnyResource {
  return {
    resourceType: 'Observation',
    id,
    status: 'final',
    ...(category ? { category: [{ coding: [category] }] } : {}),
  } as any;
}

/** label → count, for terse assertions about the resulting tab strip. */
function counts(categories: ReturnType<typeof buildCategories>) {
  return categories.map((c) => [c.label, c.resources.length] as const);
}

describe('categoryCodings / hasCategoryCode', () => {
  it('reads every coding that carries a code', () => {
    const resource = observation('o1', { system: HL7_CATEGORY, code: 'vital-signs' });
    expect(categoryCodings(resource).map((c) => c.code)).toEqual(['vital-signs']);
    expect(hasCategoryCode(resource, 'vital-signs')).toBe(true);
    expect(hasCategoryCode(resource, 'exam')).toBe(false);
  });

  it('treats a resource with no category, or a coding with no code, as uncategorised', () => {
    expect(categoryCodings(observation('o2'))).toEqual([]);
    expect(hasCategoryCode(observation('o2'), 'exam')).toBe(false);
    expect(categoryCodings({ resourceType: 'Observation', category: [{ coding: [{}] }] } as any)).toEqual([]);
  });
});

describe('buildCategories', () => {
  it('routes each observation to its configured category', () => {
    const categories = buildCategories(
      [
        observation('v', { system: HL7_CATEGORY, code: 'vital-signs' }),
        observation('e', { system: HL7_CATEGORY, code: 'exam' }),
        observation('l', { system: HL7_CATEGORY, code: 'laboratory' }),
      ],
      configured,
      UNCATEGORISED,
    );

    expect(counts(categories)).toEqual([
      ['Encounters', 0],
      ['Vitals', 1],
      ['Exam findings', 1],
      ['Lab results', 1],
      ['Other observations', 0],
    ]);
  });

  it('gives an unconfigured standard category its own tab instead of mislabelling it', () => {
    // `survey` is what this SHR's triage-acuity profile fixes, and nothing in
    // the config claims it. Before this it landed under the catch-all, which
    // read "Lab results" — a triage score displayed as a lab result.
    const categories = buildCategories(
      [observation('t', { system: HL7_CATEGORY, code: 'survey' })],
      configured,
      UNCATEGORISED,
    );

    expect(counts(categories)).toContainEqual(['Survey', 1]);
    expect(counts(categories)).toContainEqual(['Lab results', 0]);
    expect(counts(categories)).toContainEqual(['Other observations', 0]);
  });

  it('labels a discovered category from the payload’s own display when it has one', () => {
    const categories = buildCategories(
      [observation('c', { system: SHA_CATEGORY, code: 'caller-reported', display: 'Reported by caller' })],
      configured,
      UNCATEGORISED,
    );

    // Distinct from the bundled display ("Caller reported"), so this really does
    // prove the payload's own display wins.
    expect(counts(categories)).toContainEqual(['Reported by caller', 1]);
  });

  it('falls back to a readable form of a code it cannot resolve a display for', () => {
    const categories = buildCategories(
      [observation('s', { system: HL7_CATEGORY, code: 'social-history' })],
      configured,
      UNCATEGORISED,
    );

    expect(counts(categories)).toContainEqual(['Social history', 1]);
  });

  it('groups every observation sharing a discovered code into one tab, sorted by label', () => {
    const categories = buildCategories(
      [
        observation('c1', { system: SHA_CATEGORY, code: 'emt-assessed' }),
        observation('t1', { system: HL7_CATEGORY, code: 'survey' }),
        observation('c2', { system: SHA_CATEGORY, code: 'emt-assessed' }),
      ],
      configured,
      UNCATEGORISED,
    );

    // `emt-assessed` resolves to its bundled display rather than a humanised code.
    const discovered = counts(categories).filter(([label]) =>
      ['Emergency practitioner assessed', 'Survey'].includes(label),
    );
    expect(discovered).toEqual([
      ['Emergency practitioner assessed', 2],
      ['Survey', 1],
    ]);
  });

  it('sends only genuinely uncategorised observations to the catch-all', () => {
    const categories = buildCategories(
      [
        observation('none'),
        observation('v', { system: HL7_CATEGORY, code: 'vital-signs' }),
        observation('t', { system: HL7_CATEGORY, code: 'survey' }),
      ],
      configured,
      UNCATEGORISED,
    );

    expect(counts(categories)).toContainEqual(['Other observations', 1]);
    expect(counts(categories)).toContainEqual(['Vitals', 1]);
    expect(counts(categories)).toContainEqual(['Survey', 1]);
  });

  it('still holds every resource type nothing splits by category', () => {
    const categories = buildCategories(
      [
        { resourceType: 'Encounter', id: 'e1' } as any,
        // A category on a type nobody split must not change where it goes.
        { resourceType: 'Encounter', id: 'e2', category: [{ coding: [{ code: 'whatever' }] }] } as any,
      ],
      configured,
      UNCATEGORISED,
    );

    expect(counts(categories)).toContainEqual(['Encounters', 2]);
  });

  it('never drops a record, even with no catch-all configured for a split type', () => {
    const noCatchAll: ShrResourceTypeConfig[] = [
      { resourceType: 'Observation', label: 'Vitals', categoryCode: 'vital-signs' },
    ];
    const categories = buildCategories(
      [observation('none'), observation('v', { system: HL7_CATEGORY, code: 'vital-signs' })],
      noCatchAll,
      UNCATEGORISED,
    );

    expect(counts(categories)).toEqual([
      ['Vitals', 1],
      ['Uncategorised', 1],
    ]);
    const total = categories.reduce((sum, c) => sum + c.resources.length, 0);
    expect(total).toBe(2);
  });

  it('files a resource carrying two configured codes under the earlier one only', () => {
    const both = {
      resourceType: 'Observation',
      id: 'both',
      category: [{ coding: [{ system: HL7_CATEGORY, code: 'exam' }] }, { coding: [{ code: 'vital-signs' }] }],
    } as any;

    const categories = buildCategories([both], configured, UNCATEGORISED);

    // Vitals is configured before Exam findings, so it claims it — and it is
    // claimed exactly once, not shown under both.
    expect(counts(categories)).toContainEqual(['Vitals', 1]);
    expect(counts(categories)).toContainEqual(['Exam findings', 0]);
    expect(categories.reduce((sum, c) => sum + c.resources.length, 0)).toBe(1);
  });

  it('ignores resource types the viewer was not configured to show', () => {
    const categories = buildCategories([{ resourceType: 'Patient', id: 'p1' } as any], configured, UNCATEGORISED);

    expect(categories.every((c) => c.resourceType !== 'Patient')).toBe(true);
    expect(categories.reduce((sum, c) => sum + c.resources.length, 0)).toBe(0);
  });
});
