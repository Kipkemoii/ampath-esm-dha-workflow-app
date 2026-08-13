import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import {
  createPreauthRequest,
  extractPreauthStatusForIntervention,
  fetchShaInterventionByCode,
  getPreauthPreview,
  getServiceType,
  listPreAuthRequests,
  patchPreAuthRequest,
  type ListPreAuthRequestsParams,
} from '../../../../../claims/claims.resource';
import {
  fetchPatientDiagnosesForBilling,
  preferredDiagnosisForPreauth,
} from '../../../../billing-claims.resource';
import type { Intervention, PreAuthRequestRecord, PreauthRequest } from '../../../../../claims/index';
import type { AmrsVisitDiagnosis } from '../../../../types';
import { IdentifierTypesUuids } from '../../../../../resources/identifier-types';
import { createOrderEncounter, getOrder } from '../../../../../shared/services/encounters.resource';
import type { CreateOrderEncounterDto } from '../../../../../shared/types';
import {
  CLINICAL_INDICATIONS_CONCEPT_UUID,
  fetchPreauthFormValues,
  PREAUTH_ENCOUNTER_TYPE_UUID,
  PREAUTH_FORM_CONCEPTS,
  PREAUTH_INTERVENTION_TYPE,
  searchDiagnosisConcepts,
  type DiagnosisConceptHit,
} from '../preauth.resource';

type ConceptMappingLike = {
  display?: string;
  conceptReferenceTerm?: {
    code?: string;
    name?: string;
    conceptSource?: { uuid?: string; name?: string; hl7Code?: string };
  };
};

export type ElectiveConceptOption = {
  uuid: string;
  display: string;
  /** Mappings from dictionary search — SHA code is resolved only after selection. */
  mappings?: ConceptMappingLike[];
};

/** SHA concept source name in OpenMRS (reference term source). */
export const SHA_CONCEPT_SOURCE = 'SHA';

/** Extract intervention code from mappings whose concept source is SHA. */
export function extractShaCodeFromConcept(concept: {
  mappings?: ConceptMappingLike[];
}): string {
  for (const m of concept.mappings ?? []) {
    const term = m.conceptReferenceTerm;
    if (!term) continue;
    const sourceName = String(term.conceptSource?.name ?? '').trim();
    if (sourceName.toUpperCase() !== SHA_CONCEPT_SOURCE) continue;
    const code = String(term.code ?? '').trim().toUpperCase();
    if (code) return code.startsWith('SHA') ? code : `SHA-${code}`;
  }
  for (const m of concept.mappings ?? []) {
    const display = String(m.display ?? '');
    // e.g. "SHA: SHA-06-031" or "SHA: 06-031"
    if (!/^SHA\s*:/i.test(display) && !display.toUpperCase().startsWith('SHA:')) continue;
    const match = display.match(/SHA-\d[\w-]*/i) ?? display.split(':').pop()?.trim();
    if (match) {
      const code = String(match).trim().toUpperCase();
      return code.startsWith('SHA') ? code : `SHA-${code}`;
    }
  }
  return '';
}

const CONCEPT_SEARCH_REPR =
  'custom:(uuid,display,mappings:(display,conceptReferenceTerm:(uuid,code,name,conceptSource:(uuid,name,hl7Code))))';

/**
 * Search the OpenMRS concept dictionary (name / code).
 * Results are concepts with mappings attached; SHA code is read on select.
 */
export async function searchElectiveConcepts(q: string): Promise<ElectiveConceptOption[]> {
  const term = (q ?? '').trim();
  if (term.length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    q: term,
    limit: '25',
    v: CONCEPT_SEARCH_REPR,
  });

  try {
    const response = await openmrsFetch(`${restBaseUrl}/concept?${params.toString()}`);
    const results =
      (response?.data?.results as Array<{
        uuid: string;
        display: string;
        mappings?: ConceptMappingLike[];
      }>) ?? [];

    const out: ElectiveConceptOption[] = [];
    const seen = new Set<string>();
    for (const c of results) {
      if (!c?.uuid || seen.has(c.uuid)) continue;
      seen.add(c.uuid);
      out.push({
        uuid: c.uuid,
        display: c.display || c.uuid,
        mappings: c.mappings ?? [],
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function fetchPatientCrNumber(
  patientUuid: string,
  identifierTypeUuid: string,
): Promise<string> {
  if (!patientUuid || !identifierTypeUuid) return '';
  try {
    const res = await openmrsFetch(
      `${restBaseUrl}/patient/${patientUuid}?v=custom:(uuid,identifiers:(identifier,identifierType:(uuid)))`,
    );
    const identifiers = (res?.data?.identifiers ?? []) as Array<{
      identifier?: string;
      identifierType?: { uuid?: string };
    }>;
    const hit = identifiers.find((i) => i.identifierType?.uuid === identifierTypeUuid);
    return String(hit?.identifier ?? '').trim();
  } catch {
    return '';
  }
}

export type ElectiveDiagnosisOption = {
  key: string;
  conceptUuid: string;
  display: string;
  icd11Code: string;
  rank?: number | null;
  source: 'visit' | 'search';
};

export type ElectiveCaptureInput = {
  patientUuid: string;
  locationUuid: string;
  encounterTypeUuid: string;
  concept: ElectiveConceptOption;
  intervention: Intervention;
  clinicalIndications: string;
  expectedServiceStartDate: string;
  chiefComplaint?: string;
  hpi?: string;
  physicalExam?: string;
  investigations?: string;
  anaesthesia?: string;
  surgeryDate?: string;
  relatedToEmployment?: boolean;
  relatedToAccident?: boolean;
  isCoInsured?: boolean;
  coInsuranceDetails?: string;
  sessionsRequired?: string;
  frequency?: string;
  startDate?: string;
  necessity?: string;
  lensPrescription?: string;
  newOrReplacement?: string;
  lensAmount?: string;
  eyeExamAmount?: string;
  frameAmount?: string;
  /** Primary diagnosis on the preauth encounter (UI field; preferably prefilled from today’s visit) */
  diagnosis?: ElectiveDiagnosisOption | null;
  /** Session / selected provider — stored on the encounter for Accounting Raise */
  providerUuid?: string;
  /** Optional override; otherwise Clinician/Unknown role is resolved from OpenMRS */
  encounterRoleUuid?: string;
  /** ISO datetime for encounter */
  encounterDatetime?: string;
};

/** OpenMRS core default "Unknown" encounter role — fallback if lookup fails. */
const DEFAULT_ENCOUNTER_ROLE_UUID = 'a0b03050-c99b-11e0-9572-0800200c9a66';

const HIE_ANAESTHESIA_TO_CONCEPT: Record<string, string> = {
  GENERAL: '7a69a31a-d88f-4ebd-a00b-cb5b4581de00',
  LOCAL: '074225d4-b1be-56e9-93f6-255ebf106df3',
  SEDATION: '3fa5c3a8-41e5-493a-9ab7-7177fc6f8c82',
  SPINAL: 'f45ac884-e73e-4b02-9d8b-49c4e3ce5a15',
};

const HIE_FREQUENCY_TO_CONCEPT: Record<string, string> = {
  ONCE_A_WEEK: '5dcfe297-2ef7-4f1c-97e3-a519c18fcc84',
  TWICE_A_WEEK: '6f4a4c5b-34d4-4577-b1f2-c0e5d5a61374',
  ONCE_EVERY_2_WEEKS: '690b2ab2-4cbc-4df4-be19-64b8a93981ab',
  ONCE_EVERY_3_WEEKS: '72ec1de0-4bf0-4c40-9329-b8f574a64132',
  ONCE_A_MONTH: 'a899d7f6-1350-11df-a1f1-0026b9348838',
};

const LENS_TO_CONCEPT: Record<string, string> = {
  FRAMES_LENSES: '51fc8b51-c35d-4025-9d25-fef5d0d44b47',
  FRAMED: '51fc8b51-c35d-4025-9d25-fef5d0d44b47',
  CONTACT: 'da45c81a-e0fc-4589-8094-cb6fb7a7a285',
};

const NEW_OR_REPL_TO_CONCEPT: Record<string, string> = {
  NEW: 'a8a48066-1350-11df-a1f1-0026b9348838',
  REPLACEMENT: 'f021d384-65cd-47b5-b96c-6dc738a00452',
};

function interventionTypeConcept(intervention: Intervention): string {
  const flags = {
    requiresSurgicalPreauth: Boolean(intervention.requiresSurgicalPreauth),
    requiresRenalPreauth: Boolean(intervention.requiresRenalPreauth),
    requiresOncologyPreauth: Boolean(intervention.requiresOncologyPreauth),
    requiresRadiologyPreauth: Boolean(intervention.requiresRadiologyPreauth),
    requiresOpticalPreauth: Boolean(intervention.requiresOpticalPreauth),
  };
  if (flags.requiresSurgicalPreauth) return PREAUTH_INTERVENTION_TYPE.surgical;
  if (flags.requiresRenalPreauth) return PREAUTH_INTERVENTION_TYPE.renal;
  if (flags.requiresOncologyPreauth) return PREAUTH_INTERVENTION_TYPE.oncology;
  if (flags.requiresRadiologyPreauth) return PREAUTH_INTERVENTION_TYPE.imaging;
  if (flags.requiresOpticalPreauth) return PREAUTH_INTERVENTION_TYPE.optical;
  return PREAUTH_INTERVENTION_TYPE.normal;
}

let cachedEncounterRoleUuid: string | null = null;

async function resolveEncounterRoleUuid(configured?: string): Promise<string> {
  const fromConfig = (configured ?? '').trim();
  if (fromConfig) return fromConfig;
  if (cachedEncounterRoleUuid) return cachedEncounterRoleUuid;

  try {
    const res = await openmrsFetch(
      `${restBaseUrl}/encounterrole?v=custom:(uuid,display,retired)&limit=50`,
    );
    const results = (res?.data?.results ?? []) as Array<{
      uuid?: string;
      display?: string;
      retired?: boolean;
    }>;
    const active = results.filter((r) => r.uuid && !r.retired);
    const preferred =
      active.find((r) => /clinician/i.test(String(r.display ?? ''))) ||
      active.find((r) => /unknown/i.test(String(r.display ?? ''))) ||
      active[0];
    if (preferred?.uuid) {
      cachedEncounterRoleUuid = preferred.uuid;
      return preferred.uuid;
    }
  } catch {
    // fall through to default
  }

  cachedEncounterRoleUuid = DEFAULT_ENCOUNTER_ROLE_UUID;
  return DEFAULT_ENCOUNTER_ROLE_UUID;
}

function plannedServiceObsConcept(configured?: string): string {
  const fromConfig = (configured ?? '').trim();
  // Only persist as encounter obs when a real Text concept UUID is configured.
  return fromConfig;
}

function buildObs(
  input: ElectiveCaptureInput,
  plannedServiceObsConceptUuid?: string,
): Array<Record<string, unknown>> {
  const C = PREAUTH_FORM_CONCEPTS;
  const obs: Array<Record<string, unknown>> = [];
  const text = (concept: string, value?: string) => {
    const v = (value ?? '').trim();
    if (!v || !concept) return;
    obs.push({ concept, value: v });
  };
  const coded = (concept: string, valueConcept?: string) => {
    const v = (valueConcept ?? '').trim();
    if (!v || !concept) return;
    obs.push({ concept, value: v });
  };
  const boolCoded = (concept: string, value?: boolean) => {
    if (value === undefined) return;
    coded(concept, value ? C.yes : C.no);
  };
  const dateObs = (concept: string, iso?: string) => {
    if (!iso) return;
    const d = dayjs(iso);
    if (!d.isValid()) return;
    obs.push({ concept, value: d.format('YYYY-MM-DDTHH:mm:ss.SSSZZ') });
  };

  obs.push({
    concept: C.typeOfIntervention,
    value: interventionTypeConcept(input.intervention),
  });

  text(C.clinicalIndication || CLINICAL_INDICATIONS_CONCEPT_UUID, input.clinicalIndications);
  dateObs(C.expectedServiceStartDate || C.startDate, input.expectedServiceStartDate);
  // Free-text chief complaint → "Specify other complaints" concept.
  text(C.otherComplaint, input.chiefComplaint);
  text(C.hpi, input.hpi);
  text(C.generalExam, input.physicalExam);
  text(C.investigation, input.investigations);

  if (input.anaesthesia) {
    coded(C.anaesthesia, HIE_ANAESTHESIA_TO_CONCEPT[input.anaesthesia] || input.anaesthesia);
  }
  // Surgery date is not a dedicated form concept — reuse startDate when surgical.
  dateObs(C.startDate, input.surgeryDate || input.startDate);

  boolCoded(C.employmentRelated, input.relatedToEmployment);
  boolCoded(C.accidentRelated, input.relatedToAccident);
  boolCoded(C.coInsured, input.isCoInsured);
  text(C.coInsuredDetails, input.coInsuranceDetails);

  if (input.sessionsRequired?.trim()) {
    obs.push({ concept: C.sessionNumber, value: Number(input.sessionsRequired) });
  }
  if (input.frequency) {
    coded(C.frequencyOfSessions, HIE_FREQUENCY_TO_CONCEPT[input.frequency] || input.frequency);
  }

  if (input.lensPrescription) {
    coded(C.lens, LENS_TO_CONCEPT[input.lensPrescription] || input.lensPrescription);
  }
  if (input.newOrReplacement) {
    coded(C.newRequest, NEW_OR_REPL_TO_CONCEPT[input.newOrReplacement] || input.newOrReplacement);
  }
  if (input.lensAmount?.trim()) {
    obs.push({ concept: C.lensAmount, value: Number(input.lensAmount) });
  }
  if (input.eyeExamAmount?.trim()) {
    obs.push({ concept: C.eyeExaminationAmount, value: Number(input.eyeExamAmount) });
  }
  if (input.frameAmount?.trim()) {
    obs.push({ concept: C.frameAmount, value: Number(input.frameAmount) });
  }

  // Planned orderable concept UUID (text) — used later by Create Order.
  const orderableUuid = (input.concept?.uuid ?? '').trim();
  if (orderableUuid) {
    text(plannedServiceObsConcept(plannedServiceObsConceptUuid), orderableUuid);
  }

  return obs;
}

/** Form question concept UUIDs we manage on elective capture (void these on edit). */
function electiveManagedConceptUuids(plannedServiceObsConceptUuid?: string): Set<string> {
  const C = PREAUTH_FORM_CONCEPTS;
  return new Set(
    [
      C.typeOfIntervention,
      C.clinicalIndication,
      CLINICAL_INDICATIONS_CONCEPT_UUID,
      C.startDate,
      C.expectedServiceStartDate,
      C.otherComplaint,
      C.hpi,
      C.generalExam,
      C.investigation,
      C.anaesthesia,
      C.employmentRelated,
      C.accidentRelated,
      C.coInsured,
      C.coInsuredDetails,
      C.sessionNumber,
      C.frequencyOfSessions,
      C.lens,
      C.newRequest,
      C.lensAmount,
      C.eyeExaminationAmount,
      C.frameAmount,
      C.plannedServiceConcept,
      plannedServiceObsConcept(plannedServiceObsConceptUuid),
    ].filter(Boolean),
  );
}

export async function createElectivePreauthEncounter(
  input: ElectiveCaptureInput & { plannedServiceObsConceptUuid?: string },
): Promise<{ uuid: string }> {
  const encounterType = input.encounterTypeUuid || PREAUTH_ENCOUNTER_TYPE_UUID;
  const providerUuid = (input.providerUuid ?? '').trim();
  if (!providerUuid) {
    throw new Error('A provider is required to save the elective preauth encounter');
  }

  const encounterRole = await resolveEncounterRoleUuid(input.encounterRoleUuid);
  const diagnosisConceptUuid = (input.diagnosis?.conceptUuid ?? '').trim();
  const body: Record<string, unknown> = {
    patient: input.patientUuid,
    encounterType,
    location: input.locationUuid,
    encounterDatetime: input.encounterDatetime || dayjs().format('YYYY-MM-DDTHH:mm:ss.SSSZZ'),
    encounterProviders: [
      {
        provider: providerUuid,
        encounterRole,
      },
    ],
    obs: buildObs(input, input.plannedServiceObsConceptUuid),
    // OpenMRS 2.2+ encounter resource — same shape as GET encounter.diagnoses
    diagnoses: diagnosisConceptUuid
      ? [
          {
            patient: input.patientUuid,
            rank: Number(input.diagnosis?.rank) > 0 ? Number(input.diagnosis?.rank) : 1,
            certainty: 'CONFIRMED',
            diagnosis: {
              coded: diagnosisConceptUuid,
            },
          },
        ]
      : [],
  };
  const res = await openmrsFetch(`${restBaseUrl}/encounter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const uuid = String(res?.data?.uuid ?? '');
  if (!uuid) {
    throw new Error('Failed to create preauth encounter');
  }

  return { uuid };
}

export type ElectiveEncounterObsProps = {
  uuid: string;
  conceptUuid: string;
};

export type ElectiveEncounterEditModel = {
  encounterUuid: string;
  hold: PreAuthRequestRecord | null;
  formValues: Awaited<ReturnType<typeof fetchPreauthFormValues>>;
  plannedConcept: ElectiveConceptOption | null;
  existingObs: ElectiveEncounterObsProps[];
  diagnoses: ElectiveDiagnosisOption[];
};

/**
 * Load an elective preauth encounter for edit — form obs, planned orderable concept, hold.
 */
export async function loadElectiveEncounterForEdit(
  encounterUuid: string,
  patientUuid: string,
  plannedServiceObsConceptUuid?: string,
): Promise<ElectiveEncounterEditModel> {
  const encUuid = (encounterUuid ?? '').trim();
  if (!encUuid) {
    throw new Error('Missing encounter UUID');
  }

  const res = await openmrsFetch(
    `${restBaseUrl}/encounter/${encUuid}?v=custom:(uuid,encounterDatetime,diagnoses:(uuid,display,rank,certainty,diagnosis:(coded:(uuid,display))),obs:(uuid,voided,concept:(uuid,display),value,valueText,valueCodedName))`,
  );
  const enc = res?.data as Record<string, unknown> | undefined;
  if (!enc?.uuid) {
    throw new Error('Encounter not found');
  }

  const obsList = (Array.isArray(enc.obs) ? enc.obs : []) as Array<Record<string, unknown>>;
  const existingObs: ElectiveEncounterObsProps[] = [];
  for (const o of obsList) {
    if (o.voided) continue;
    const ou = String(o.uuid ?? '').trim();
    const cu = conceptUuid(o);
    if (ou && cu) existingObs.push({ uuid: ou, conceptUuid: cu });
  }

  const plannedQ = plannedServiceObsConcept(plannedServiceObsConceptUuid);
  let plannedConceptUuid =
    obsText(obsList.find((o) => !o.voided && conceptUuid(o) === plannedQ)) || '';

  let hold: PreAuthRequestRecord | null = null;
  try {
    const holds = await fetchElectiveHolds({ encounterUuid: encUuid });
    hold = holds[0] ?? null;
  } catch {
    hold = null;
  }
  if (!plannedConceptUuid) {
    plannedConceptUuid = plannedConceptUuidFromOrderNo(hold?.orderNo);
  }

  let plannedConcept: ElectiveConceptOption | null = null;
  if (plannedConceptUuid) {
    try {
      const conceptRes = await openmrsFetch(
        `${restBaseUrl}/concept/${plannedConceptUuid}?v=${encodeURIComponent(CONCEPT_SEARCH_REPR)}`,
      );
      const c = conceptRes?.data as ElectiveConceptOption | undefined;
      if (c?.uuid) {
        plannedConcept = {
          uuid: c.uuid,
          display: String(c.display ?? c.uuid),
          mappings: c.mappings,
        };
      }
    } catch {
      plannedConcept = {
        uuid: plannedConceptUuid,
        display: plannedConceptUuid,
        mappings: [],
      };
    }
  }

  const formValues = await fetchPreauthFormValues(patientUuid, encUuid);

  const diagnoses: ElectiveDiagnosisOption[] = [];
  const dxList = (Array.isArray(enc.diagnoses) ? enc.diagnoses : []) as Array<Record<string, unknown>>;
  for (const dx of dxList) {
    const diagnosis = (dx.diagnosis ?? {}) as Record<string, unknown>;
    const coded = diagnosis.coded as { uuid?: string; display?: string } | string | undefined;
    const conceptUuidDx =
      typeof coded === 'object' ? String(coded?.uuid ?? '').trim() : String(coded ?? '').trim();
    const display =
      (typeof coded === 'object' ? String(coded?.display ?? '').trim() : '') ||
      String(dx.display ?? '').trim() ||
      conceptUuidDx;
    if (!conceptUuidDx) continue;
    diagnoses.push({
      key: `enc-dx-${conceptUuidDx}`,
      conceptUuid: conceptUuidDx,
      display,
      icd11Code: '',
      rank: typeof dx.rank === 'number' ? dx.rank : Number(dx.rank) || 1,
      source: 'visit',
    });
  }

  return {
    encounterUuid: encUuid,
    hold,
    formValues,
    plannedConcept,
    existingObs,
    diagnoses,
  };
}

/**
 * Update elective preauth encounter obs via OpenMRS void-and-replace:
 * same `obs` array includes `{ uuid, voided: true }` for current rows and new obs without uuid.
 */
export async function updateElectivePreauthEncounter(
  encounterUuid: string,
  input: ElectiveCaptureInput & { plannedServiceObsConceptUuid?: string },
  existingObs: ElectiveEncounterObsProps[],
): Promise<{ uuid: string }> {
  const encUuid = (encounterUuid ?? '').trim();
  if (!encUuid) {
    throw new Error('Missing encounter UUID');
  }

  const newObs = buildObs(input, input.plannedServiceObsConceptUuid);
  const managed = electiveManagedConceptUuids(input.plannedServiceObsConceptUuid);
  const voided = existingObs
    .filter((o) => managed.has(o.conceptUuid))
    .map((o) => ({ uuid: o.uuid, voided: true as const }));

  const body = {
    obs: [...voided, ...newObs],
  };

  const res = await openmrsFetch(`${restBaseUrl}/encounter/${encUuid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const uuid = String(res?.data?.uuid ?? encUuid);
  if (!uuid) {
    throw new Error('Failed to update preauth encounter');
  }
  return { uuid };
}

/** Update hold orderNo concept encoding when the orderable concept changes (before a real order #). */
export async function syncElectiveHoldOrderConcept(opts: {
  holdId: number;
  encounterUuid: string;
  conceptUuid: string;
  currentOrderNo?: string | null;
}): Promise<void> {
  const current = String(opts.currentOrderNo ?? '').trim();
  // Do not overwrite a real OpenMRS order number.
  if (current && !current.startsWith('ELECTIVE-')) {
    return;
  }
  const next = opts.conceptUuid
    ? `ELECTIVE-${opts.encounterUuid}::${opts.conceptUuid}`
    : `ELECTIVE-${opts.encounterUuid}`;
  if (next === current) return;
  await patchPreAuthRequest(opts.holdId, { orderNo: next });
}

function diagnosisOptionFromConcept(hit: DiagnosisConceptHit): ElectiveDiagnosisOption {
  return {
    key: `search-${hit.uuid}`,
    conceptUuid: hit.uuid,
    display: hit.display,
    icd11Code: hit.icd11Code,
    rank: 1,
    source: 'search',
  };
}

function diagnosisOptionFromVisitDx(dx: AmrsVisitDiagnosis): ElectiveDiagnosisOption | null {
  const icd11Code = String(dx.icd11_code ?? '').trim();
  const conceptUuid = String(dx.uuid ?? '').trim();
  // ETL uuid is usually the coded concept uuid for encounter-diagnosis rows.
  if (!conceptUuid && !icd11Code) return null;
  const display = icd11Code
    ? `${icd11Code} · ${dx.concept_source_name || dx.encounter_type || 'Visit diagnosis'}`
    : dx.concept_source_name || dx.encounter_type || conceptUuid;
  return {
    key: `visit-${dx.encounter_id}-${icd11Code || conceptUuid}`,
    conceptUuid,
    display,
    icd11Code,
    rank: dx.dx_rank ?? null,
    source: 'visit',
  };
}

async function ensureDiagnosisConceptUuid(
  option: ElectiveDiagnosisOption,
): Promise<ElectiveDiagnosisOption> {
  if (option.conceptUuid) return option;
  const code = (option.icd11Code ?? '').trim();
  if (!code) return option;
  try {
    const hits = await searchDiagnosisConcepts(code);
    const match =
      hits.find((h) => h.icd11Code.toUpperCase() === code.toUpperCase()) || hits[0];
    if (match?.uuid) {
      return {
        ...option,
        conceptUuid: match.uuid,
        display: option.display || match.display,
        icd11Code: option.icd11Code || match.icd11Code,
      };
    }
  } catch {
    // keep unresolved
  }
  return option;
}

/**
 * Diagnoses from today's active visit encounters (OpenMRS) plus today's ETL diagnosis rows.
 * Prefers rank-1 ICD-11 coded rows for prefill.
 */
export async function fetchTodaysVisitDiagnoses(
  patientUuid: string,
  locationUuid: string,
): Promise<{ options: ElectiveDiagnosisOption[]; preferred: ElectiveDiagnosisOption | null }> {
  if (!patientUuid || !locationUuid) {
    return { options: [], preferred: null };
  }

  const today = dayjs().format('YYYY-MM-DD');
  const options: ElectiveDiagnosisOption[] = [];
  const seen = new Set<string>();

  const addOption = (opt: ElectiveDiagnosisOption | null) => {
    if (!opt) return;
    const key = `${opt.conceptUuid}|${opt.icd11Code}`.toUpperCase();
    if (!opt.conceptUuid && !opt.icd11Code) return;
    if (seen.has(key)) return;
    seen.add(key);
    options.push(opt);
  };

  // 1) Diagnoses already on encounters in today's active visit
  try {
    const params = new URLSearchParams({
      patient: patientUuid,
      includeInactive: 'false',
      fromStartDate: dayjs().startOf('day').toISOString(),
      location: locationUuid,
      v: 'custom:(uuid,startDatetime,stopDatetime,encounters:(uuid,encounterDatetime,diagnoses:(uuid,display,rank,certainty,diagnosis:(coded:(uuid,display),nonCoded))))',
      limit: '1',
    });
    const visitRes = await openmrsFetch(`${restBaseUrl}/visit?${params.toString()}`);
    const visit = (visitRes?.data?.results ?? [])[0] as
      | { encounters?: Array<Record<string, unknown>> }
      | undefined;
    const encounters = visit?.encounters ?? [];
    for (const enc of encounters) {
      const diagnoses = (Array.isArray(enc.diagnoses) ? enc.diagnoses : []) as Array<
        Record<string, unknown>
      >;
      for (const dx of diagnoses) {
        const diagnosis = (dx.diagnosis ?? dx.condition ?? {}) as Record<string, unknown>;
        const coded = diagnosis.coded as { uuid?: string; display?: string } | string | undefined;
        const conceptUuid =
          typeof coded === 'object' ? String(coded?.uuid ?? '').trim() : String(coded ?? '').trim();
        const display =
          (typeof coded === 'object' ? String(coded?.display ?? '').trim() : '') ||
          String(dx.display ?? '').trim() ||
          conceptUuid;
        if (!conceptUuid) continue;
        addOption({
          key: `visit-enc-${String(enc.uuid ?? '')}-${conceptUuid}`,
          conceptUuid,
          display,
          icd11Code: '',
          rank: typeof dx.rank === 'number' ? dx.rank : Number(dx.rank) || null,
          source: 'visit',
        });
      }
    }
  } catch {
    // continue with ETL
  }

  // 2) ETL visit / encounter / maternity diagnoses for today (adds ICD-11 codes)
  let etlPreferred: AmrsVisitDiagnosis | null = null;
  try {
    const etlRows = await fetchPatientDiagnosesForBilling({
      visitDate: today,
      billingDate: today,
      patientUuid,
      locationUuid,
    });
    etlPreferred = preferredDiagnosisForPreauth(etlRows);
    for (const row of etlRows) {
      addOption(diagnosisOptionFromVisitDx(row));
    }
  } catch {
    // keep OpenMRS-only options
  }

  // Resolve missing concept UUIDs via ICD-11 dictionary search
  const resolved = await Promise.all(options.map((o) => ensureDiagnosisConceptUuid(o)));
  const usable = resolved.filter((o) => o.conceptUuid);

  let preferred: ElectiveDiagnosisOption | null = null;
  if (etlPreferred) {
    const fromEtl = diagnosisOptionFromVisitDx(etlPreferred);
    if (fromEtl) {
      const resolvedPreferred = await ensureDiagnosisConceptUuid(fromEtl);
      if (resolvedPreferred.conceptUuid) {
        preferred = resolvedPreferred;
      }
    }
  }
  if (!preferred) {
    preferred =
      usable.find((o) => Number(o.rank) === 1) ||
      usable[0] ||
      null;
  }

  return { options: usable, preferred };
}

export async function searchElectiveDiagnoses(q: string): Promise<ElectiveDiagnosisOption[]> {
  const hits = await searchDiagnosisConcepts(q);
  return hits.map(diagnosisOptionFromConcept);
}

export async function holdElectivePreauthRequest(opts: {
  patientUuid: string;
  locationUuid: string;
  encounterUuid: string;
  intervention: Intervention;
  expectedServiceStartDate: string;
  conceptUuid?: string;
}): Promise<unknown> {
  const code = (opts.intervention.code ?? '').trim();
  const subBenefit =
    (opts.intervention as Intervention & { packageCode?: string }).packageCode ||
    code.split('-').slice(0, 2).join('-') ||
    code;

  const docs = (opts.intervention.applicableDocumentTypes ?? []).filter(Boolean).join(',');
  const requiredDocs = (opts.intervention.requiredPreauthDocumentTypes ?? []).filter(Boolean).join(',');

  const payload: PreauthRequest = {
    patientUuid: opts.patientUuid,
    locationUuid: opts.locationUuid,
    encounterUuid: opts.encounterUuid,
    expectedServiceStartDate: dayjs(opts.expectedServiceStartDate).toISOString(),
    // Encode planned OpenMRS concept UUID for later Create Order (replaced by real order #).
    orderNo: opts.conceptUuid
      ? `ELECTIVE-${opts.encounterUuid}::${opts.conceptUuid}`
      : `ELECTIVE-${opts.encounterUuid}`,
    subBenefitCode: subBenefit,
    interventionCode: code,
    serviceType: getServiceType(opts.intervention, 'OUTPATIENT'),
    requiresPreauth: Boolean(opts.intervention.needsPreauth),
    normalPreauth: Boolean(opts.intervention.needsPreauth) && !Boolean(opts.intervention.needsManualPreauthApproval),
    electivePreauth: true,
    applicableDocumentTypes: docs,
    requiredPreauthDocumentTypes: requiredDocs,
  };

  return createPreauthRequest(payload);
}

/** Parse planned service concept UUID from elective hold orderNo (`ELECTIVE-{enc}::{conceptUuid}`). */
export function plannedConceptUuidFromOrderNo(orderNo: string | null | undefined): string {
  const raw = String(orderNo ?? '').trim();
  const marker = '::';
  const idx = raw.indexOf(marker);
  if (idx < 0) return '';
  return raw.slice(idx + marker.length).trim();
}

/** Resolve OpenMRS concept UUID for an elective hold (orderNo encoding, then SHA dictionary match). */
export async function resolveElectiveServiceConceptUuid(opts: {
  orderNo?: string | null;
  interventionCode?: string | null;
}): Promise<string> {
  const fromOrderNo = plannedConceptUuidFromOrderNo(opts.orderNo);
  if (fromOrderNo) return fromOrderNo;

  const code = String(opts.interventionCode ?? '').trim().toUpperCase();
  if (!code) return '';

  const searchTerms = [code, code.replace(/^SHA-/, ''), code.replace(/^SHA-/i, '')].filter(
    (t, i, arr) => t.length >= 2 && arr.indexOf(t) === i,
  );
  for (const term of searchTerms) {
    try {
      const hits = await searchElectiveConcepts(term);
      const exact = hits.find((h) => extractShaCodeFromConcept(h) === code);
      if (exact?.uuid) return exact.uuid;
      const fuzzy = hits.find((h) => extractShaCodeFromConcept(h).includes(code.replace(/^SHA-/, '')));
      if (fuzzy?.uuid) return fuzzy.uuid;
    } catch {
      // try next term
    }
  }
  return '';
}

export async function resolveCoverageForConcept(
  patientCr: string,
  locationUuid: string,
  shaCode: string,
): Promise<Intervention | null> {
  return fetchShaInterventionByCode(patientCr, locationUuid, shaCode);
}

export async function fetchElectiveHolds(
  params: ListPreAuthRequestsParams,
): Promise<PreAuthRequestRecord[]> {
  return listPreAuthRequests({
    ...params,
    electivePreauth: true,
  });
}

type ElectiveHoldStatusSource = Pick<
  PreAuthRequestRecord,
  'id' | 'patientUuid' | 'interventionCode' | 'consentToken' | 'status' | 'locationUuid'
> & {
  crNo?: string;
};

/**
 * Refresh HIE statuses for elective holds that already have a consent token.
 * Holds without a token are ignored — callers must filter to raised rows only.
 */
export async function syncElectiveHoldStatusesFromPreview(
  holds: ElectiveHoldStatusSource[],
  fallbackLocationUuid: string,
): Promise<Record<number, string>> {
  const statusMap: Record<number, string> = {};
  if (!holds.length || !fallbackLocationUuid?.trim()) {
    return statusMap;
  }

  // One preview per unique consent token, then match interventions locally.
  const tokenLocations = new Map<string, string>();
  for (const hold of holds) {
    const token = String(hold.consentToken ?? '').trim();
    if (!token || tokenLocations.has(token)) continue;
    tokenLocations.set(token, String(hold.locationUuid ?? '').trim() || fallbackLocationUuid);
  }
  if (!tokenLocations.size) {
    return statusMap;
  }

  const previewByToken = new Map<string, unknown>();
  await Promise.all(
    [...tokenLocations.entries()].map(async ([token, loc]) => {
      try {
        previewByToken.set(token, await getPreauthPreview(token, loc));
      } catch {
        previewByToken.set(token, null);
      }
    }),
  );

  await Promise.all(
    holds.map(async (hold) => {
      if (hold.id == null) return;
      const token = String(hold.consentToken ?? '').trim();
      if (!token) return;

      const preview = previewByToken.get(token);
      if (!preview) return;

      // Intervention-specific status only — never visit-wide overallPreauthFinalised.
      const hieStatus = extractPreauthStatusForIntervention(preview, hold.interventionCode);
      if (!hieStatus) {
        // Token exists but this intervention is not on the preview — do not keep a
        // stale FINALISED/ACTIVE from an earlier bad sync.
        return;
      }

      statusMap[hold.id] = hieStatus;

      const holdStatus = String(hold.status ?? '')
        .trim()
        .toUpperCase();
      const normalizedHie = hieStatus.trim().toUpperCase();
      if (normalizedHie && normalizedHie !== holdStatus) {
        try {
          await patchPreAuthRequest(hold.id, { status: hieStatus });
        } catch {
          // non-blocking — UI still shows live HIE status via statusMap
        }
      }
    }),
  );

  return statusMap;
}

export type ElectiveHoldRow = PreAuthRequestRecord & {
  patientName: string;
  crNo: string;
  providerDisplay: string;
  providerUuid: string;
  providerNationalId: string;
  encounterDatetime: string;
  clinicalIndications: string;
};

function patientDisplayName(patient: Record<string, unknown> | null | undefined): string {
  if (!patient) return '';
  const display = String(patient.display ?? '').trim();
  if (display) {
    // OpenMRS often returns "Name - identifier"
    return display.split(' - ')[0]?.trim() || display;
  }
  const person = patient.person as { display?: string } | undefined;
  return String(person?.display ?? '').trim();
}

function identifierOfType(
  patient: Record<string, unknown> | null | undefined,
  typeUuid: string,
): string {
  const ids = (patient?.identifiers ?? []) as Array<{
    identifier?: string;
    identifierType?: { uuid?: string };
  }>;
  const hit = ids.find((i) => i.identifierType?.uuid === typeUuid);
  return String(hit?.identifier ?? '').trim();
}

function providerNationalIdFromAttrs(
  attributes?: Array<{ value?: string; voided?: boolean; attributeType?: { uuid?: string } }>,
): string {
  const hit = (attributes ?? []).find(
    (a) =>
      !a.voided &&
      a.attributeType?.uuid === IdentifierTypesUuids.PROVIDER_NATIONAL_ID_UUID &&
      a.value,
  );
  return hit?.value ? String(hit.value).trim() : '';
}

async function fetchPatientSummary(patientUuid: string): Promise<{
  name: string;
  crNo: string;
}> {
  try {
    const res = await openmrsFetch(
      `${restBaseUrl}/patient/${patientUuid}?v=custom:(uuid,display,person:(display),identifiers:(identifier,identifierType:(uuid)))`,
    );
    const patient = res?.data as Record<string, unknown> | undefined;
    return {
      name: patientDisplayName(patient),
      crNo: identifierOfType(patient, IdentifierTypesUuids.CLIENT_REGISTRY_NO_UUID),
    };
  } catch {
    return { name: '', crNo: '' };
  }
}

async function fetchEncounterSummary(encounterUuid: string): Promise<{
  encounterDatetime: string;
  providerDisplay: string;
  providerUuid: string;
  providerNationalId: string;
  clinicalIndications: string;
}> {
  const empty = {
    encounterDatetime: '',
    providerDisplay: '',
    providerUuid: '',
    providerNationalId: '',
    clinicalIndications: '',
  };
  if (!encounterUuid) return empty;
  try {
    const res = await openmrsFetch(
      `${restBaseUrl}/encounter/${encounterUuid}?v=custom:(uuid,encounterDatetime,encounterProviders:(display,provider:(uuid,display,attributes:(value,voided,attributeType:(uuid)))),obs:(uuid,concept:(uuid),value,valueText))`,
    );
    const enc = res?.data as Record<string, unknown> | undefined;
    if (!enc) return empty;

    const providers = (Array.isArray(enc.encounterProviders) ? enc.encounterProviders : []) as Array<{
      display?: string;
      provider?: {
        uuid?: string;
        display?: string;
        attributes?: Array<{ value?: string; voided?: boolean; attributeType?: { uuid?: string } }>;
      };
    }>;
    const primary = providers[0];
    const provider = primary?.provider;
    const providerDisplay =
      String(provider?.display ?? '').trim() ||
      String(primary?.display ?? '')
        .replace(/\s*:\s*.*$/, '')
        .trim();
    const providerUuid = String(provider?.uuid ?? '').trim();
    const providerNationalId = providerNationalIdFromAttrs(provider?.attributes);

    const obsList = (Array.isArray(enc.obs) ? enc.obs : []) as Record<string, unknown>[];
    let clinicalIndications = '';
    for (const o of obsList) {
      const cu = conceptUuid(o);
      if (cu === PREAUTH_FORM_CONCEPTS.clinicalIndication || cu === CLINICAL_INDICATIONS_CONCEPT_UUID) {
        clinicalIndications = obsText(o);
        break;
      }
    }

    return {
      encounterDatetime: String(enc.encounterDatetime ?? ''),
      providerDisplay,
      providerUuid,
      providerNationalId,
      clinicalIndications,
    };
  } catch {
    return empty;
  }
}

/** Resolve patient name, CR, and encounter provider for Accounting elective list / Raise. */
export async function enrichElectiveHolds(
  holds: PreAuthRequestRecord[],
  clientRegistryIdentifierTypeUuid?: string,
): Promise<ElectiveHoldRow[]> {
  const crType = clientRegistryIdentifierTypeUuid || IdentifierTypesUuids.CLIENT_REGISTRY_NO_UUID;

  return Promise.all(
    holds.map(async (hold) => {
      const [patient, encounter] = await Promise.all([
        fetchPatientSummary(hold.patientUuid),
        fetchEncounterSummary(hold.encounterUuid ?? ''),
      ]);
      // Prefer configured CR type when it differs from default
      let crNo = patient.crNo;
      if (crType !== IdentifierTypesUuids.CLIENT_REGISTRY_NO_UUID && hold.patientUuid) {
        try {
          crNo = (await fetchPatientCrNumber(hold.patientUuid, crType)) || crNo;
        } catch {
          // keep patient.crNo
        }
      }
      return {
        ...hold,
        patientName: patient.name || hold.patientUuid,
        crNo,
        providerDisplay: encounter.providerDisplay,
        providerUuid: encounter.providerUuid,
        providerNationalId: encounter.providerNationalId,
        encounterDatetime: encounter.encounterDatetime,
        clinicalIndications: encounter.clinicalIndications,
      };
    }),
  );
}

export type PreauthEncounterCard = {
  uuid: string;
  encounterDatetime: string;
  clinicalIndications: string;
  expectedServiceStartDate: string;
  locationDisplay: string;
  hold?: PreAuthRequestRecord | null;
  /** Planned service concept UUID when encoded on the hold orderNo */
  plannedServiceConceptUuid: string;
};

function obsText(obs: Record<string, unknown> | undefined): string {
  if (!obs) return '';
  if (typeof obs.valueText === 'string' && obs.valueText.trim()) return obs.valueText.trim();
  if (typeof obs.value === 'string' && obs.value.trim()) return obs.value.trim();
  if (obs.value && typeof obs.value === 'object' && 'display' in (obs.value as object)) {
    return String((obs.value as { display?: string }).display ?? '').trim();
  }
  return '';
}

function obsDate(obs: Record<string, unknown> | undefined): string {
  if (!obs) return '';
  const raw =
    (typeof obs.valueDate === 'string' && obs.valueDate) ||
    (typeof obs.valueDatetime === 'string' && obs.valueDatetime) ||
    (typeof obs.value === 'string' && obs.value) ||
    '';
  const d = dayjs(raw);
  return d.isValid() ? d.format('YYYY-MM-DD') : '';
}

function conceptUuid(obs: Record<string, unknown>): string {
  const c = obs.concept;
  if (c && typeof c === 'object' && 'uuid' in (c as object)) {
    return String((c as { uuid?: string }).uuid ?? '');
  }
  return typeof c === 'string' ? c : '';
}

/** List PREAUTHORIZATION encounters for the patient chart elective page. */
export async function fetchPreauthEncounterCards(
  patientUuid: string,
  encounterTypeUuid?: string,
  locationUuid?: string,
): Promise<PreauthEncounterCard[]> {
  if (!patientUuid) return [];
  const typeUuid = encounterTypeUuid || PREAUTH_ENCOUNTER_TYPE_UUID;
  try {
    const qs = new URLSearchParams({
      patient: patientUuid,
      encounterType: typeUuid,
      v: 'custom:(uuid,encounterDatetime,location:(display),obs:(uuid,concept:(uuid),value,valueText,valueDate,valueDatetime))',
      limit: '50',
    });
    const res = await openmrsFetch(`${restBaseUrl}/encounter?${qs.toString()}`);
    const results = (res?.data?.results ?? []) as Array<Record<string, unknown>>;

    // Chart view: load holds by patient only so a session location mismatch does not
    // hide ACTIVE / raised rows (location filter still applies to Accounting lists).
    let holds: PreAuthRequestRecord[] = [];
    try {
      holds = await fetchElectiveHolds({ patientUuid });
    } catch {
      holds = [];
    }

    const holdByEncounter = new Map<string, PreAuthRequestRecord>();
    for (const h of holds) {
      const encUuid = String(h.encounterUuid ?? '').trim();
      if (encUuid) {
        holdByEncounter.set(encUuid, h);
        continue;
      }
      // Fallback: ELECTIVE-{encounterUuid} or ELECTIVE-{encounterUuid}::{conceptUuid}
      const orderNo = String(h.orderNo ?? '').trim();
      const m = orderNo.match(/^ELECTIVE-([0-9a-f-]{36})(?:::|$)/i);
      if (m?.[1]) {
        holdByEncounter.set(m[1], h);
      }
    }

    const cards: PreauthEncounterCard[] = results.map((enc) => {
      const uuid = String(enc.uuid ?? '');
      const obsList = (Array.isArray(enc.obs) ? enc.obs : []) as Record<string, unknown>[];
      const byConcept = new Map<string, Record<string, unknown>>();
      for (const o of obsList) {
        const cu = conceptUuid(o);
        if (cu) byConcept.set(cu, o);
      }
      const clinical = obsText(byConcept.get(PREAUTH_FORM_CONCEPTS.clinicalIndication));
      const expected = obsDate(byConcept.get(PREAUTH_FORM_CONCEPTS.expectedServiceStartDate || PREAUTH_FORM_CONCEPTS.startDate));
      const loc = enc.location as { display?: string } | undefined;
      const hold = holdByEncounter.get(uuid) ?? null;
      const plannedFromObs = (() => {
        const configured = plannedServiceObsConcept();
        if (configured) {
          const t = obsText(byConcept.get(configured));
          if (t) return t;
        }
        return (
          obsText(byConcept.get(PREAUTH_FORM_CONCEPTS.plannedServiceConcept)) || ''
        );
      })();
      return {
        uuid,
        encounterDatetime: String(enc.encounterDatetime ?? ''),
        clinicalIndications: clinical,
        expectedServiceStartDate: expected,
        locationDisplay: String(loc?.display ?? ''),
        hold,
        plannedServiceConceptUuid:
          plannedFromObs || plannedConceptUuidFromOrderNo(hold?.orderNo),
      };
    });

    // Also surface holds whose encounter is missing from the OpenMRS list (wrong encounter
    // type config, etc.) so ACTIVE preauths are not invisible.
    const seenEncounters = new Set(cards.map((c) => c.uuid));
    for (const h of holds) {
      const encUuid = String(h.encounterUuid ?? '').trim();
      const fromOrder = String(h.orderNo ?? '').match(/^ELECTIVE-([0-9a-f-]{36})(?:::|$)/i)?.[1];
      const key = encUuid || fromOrder || '';
      if (!key || seenEncounters.has(key)) continue;
      seenEncounters.add(key);
      cards.push({
        uuid: key,
        encounterDatetime: h.dateCreated || '',
        clinicalIndications: '',
        expectedServiceStartDate: h.expectedServiceStartDate
          ? dayjs(h.expectedServiceStartDate).format('YYYY-MM-DD')
          : '',
        locationDisplay: '',
        hold: h,
        plannedServiceConceptUuid: plannedConceptUuidFromOrderNo(h.orderNo),
      });
    }

    return cards.sort((a, b) => {
      const ta = dayjs(a.encounterDatetime).valueOf() || 0;
      const tb = dayjs(b.encounterDatetime).valueOf() || 0;
      return tb - ta;
    });
  } catch {
    return [];
  }
}

/** REST order subclass for POST /encounter orders (must match OrderType.javaClassName). */
export type RestOrderType = 'order' | 'testorder' | 'drugorder';

function restTypeFromJavaClassName(javaClassName: string | null | undefined): RestOrderType | null {
  const name = String(javaClassName ?? '').trim();
  if (!name) return null;
  if (name.endsWith('TestOrder') || name === 'org.openmrs.TestOrder') return 'testorder';
  if (name.endsWith('DrugOrder') || name === 'org.openmrs.DrugOrder') return 'drugorder';
  if (name.endsWith('.Order') || name === 'org.openmrs.Order') return 'order';
  return null;
}

function restTypeFromConceptClassName(className: string | null | undefined): RestOrderType {
  const n = String(className ?? '')
    .trim()
    .toLowerCase();
  if (!n) return 'order';
  if (n.includes('drug')) return 'drugorder';
  // LabTest, Test, LabSet, etc. map to TestOrder via order_type_class_map in most AMRS installs.
  if (n.includes('test') || n.includes('lab')) return 'testorder';
  return 'order';
}

/**
 * Resolve the REST `type` for an orderable concept so OpenMRS does not reject
 * the payload (e.g. TestOrder order type vs plain Order instance).
 */
export async function resolveRestOrderTypeForConcept(conceptUuid: string): Promise<RestOrderType> {
  const uuid = (conceptUuid ?? '').trim();
  if (!uuid) return 'order';

  let conceptClassUuid = '';
  let conceptClassName = '';
  try {
    const conceptRes = await openmrsFetch(
      `${restBaseUrl}/concept/${uuid}?v=custom:(uuid,conceptClass:(uuid,display,name))`,
    );
    const cc = conceptRes?.data?.conceptClass as
      | { uuid?: string; display?: string; name?: string }
      | undefined;
    conceptClassUuid = String(cc?.uuid ?? '').trim();
    conceptClassName = String(cc?.display ?? cc?.name ?? '').trim();
  } catch {
    return 'order';
  }

  try {
    const otRes = await openmrsFetch(
      `${restBaseUrl}/ordertype?v=custom:(uuid,display,javaClassName,conceptClasses:(uuid,display))&limit=100`,
    );
    const types = (otRes?.data?.results ?? []) as Array<{
      javaClassName?: string;
      conceptClasses?: Array<{ uuid?: string; display?: string }>;
    }>;

    if (conceptClassUuid) {
      const matched = types.find((t) =>
        (t.conceptClasses ?? []).some((c) => c?.uuid === conceptClassUuid),
      );
      const fromMap = restTypeFromJavaClassName(matched?.javaClassName);
      if (fromMap) return fromMap;
    }
  } catch {
    // fall through to class-name heuristic
  }

  return restTypeFromConceptClassName(conceptClassName);
}

/** Create an OpenMRS order for an ACTIVE/FINALISED elective preauth using the planned service concept. */
export async function createElectiveServiceOrder(opts: {
  patientUuid: string;
  visitUuid: string;
  locationUuid: string;
  providerUuid: string;
  conceptUuid: string;
  orderEncounterTypeUuid: string;
  outPatientCareSettingUuid: string;
}): Promise<{ orderUuid: string; orderNumber: string }> {
  const conceptUuid = (opts.conceptUuid ?? '').trim();
  if (!conceptUuid) {
    throw new Error('Missing planned service concept for order');
  }
  if (!opts.providerUuid?.trim()) {
    throw new Error('A provider is required to create the order');
  }
  if (!opts.orderEncounterTypeUuid?.trim() || !opts.outPatientCareSettingUuid?.trim()) {
    throw new Error('Order encounter type and outpatient care setting must be configured');
  }

  const orderRestType = await resolveRestOrderTypeForConcept(conceptUuid);

  const dto: CreateOrderEncounterDto = {
    patient: opts.patientUuid,
    location: opts.locationUuid,
    encounterType: opts.orderEncounterTypeUuid,
    encounterDatetime: new Date().toISOString(),
    visit: opts.visitUuid,
    obs: [],
    orders: [
      {
        action: 'NEW',
        type: orderRestType,
        patient: opts.patientUuid,
        careSetting: opts.outPatientCareSettingUuid,
        orderer: opts.providerUuid,
        concept: conceptUuid,
        urgency: 'ROUTINE',
      },
    ],
  };

  const encounter = await createOrderEncounter(dto);
  const createdOrder = encounter?.orders?.[0];
  if (!createdOrder?.uuid) {
    throw new Error('Order encounter was created without an order');
  }

  const order = await getOrder(createdOrder.uuid);
  const orderNumber = String(order?.orderNumber ?? '').trim();
  if (!orderNumber) {
    throw new Error('Order was created but order number is missing');
  }
  return { orderUuid: createdOrder.uuid, orderNumber };
}
