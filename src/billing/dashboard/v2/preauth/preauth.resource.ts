import { openmrsFetch, restBaseUrl, type Visit } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { fetchFacilityPreauthBills, fetchPatientFacilityBillDetails } from '../../../billing-claims.resource';
import { fetchShaInterventionByCode } from '../../../../claims/claims.resource';
import { type Intervention } from '../../../../claims';
import { IdentifierTypesUuids } from '../../../../resources/identifier-types';
import { type PatientFacilityBillDetails } from '../types';
import { getConsentToken } from '../../../../shared/services/claims.resource';

const PREAUTH_CODE_KEY = 'ampath.preauthCode';

export const asBool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  return false;
};

/** Score how well a billable_service name matches an intervention / service hint. */
function scoreBillableServiceMatch(billableService: string | null | undefined, hint: string | null | undefined): number {
  const a = (billableService ?? '').toLowerCase().trim();
  const b = (hint ?? '').toLowerCase().trim();
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  const tokensA = a.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  const tokensB = b.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  if (!tokensA.length || !tokensB.length) return 0;
  const overlap = tokensA.filter((t) => tokensB.includes(t)).length;
  return overlap * 15;
}

/**
 * Pick the bill line for a preauth intervention.
 * Same intervention_code can appear on multiple lines (e.g. HEMOGLOBIN + HEMODIALYSIS) —
 * prefer the line whose billable_service best matches the service hint / intervention name.
 */
export function pickBillLineForIntervention(
  bills: PatientFacilityBillDetails[],
  interventionCode: string,
  serviceHint?: string | null,
): PatientFacilityBillDetails | null {
  const code = (interventionCode ?? '').trim();
  if (!code || !bills?.length) return null;

  const byCode = bills.filter((b) => (b.intervention_code ?? '').trim() === code);
  if (!byCode.length) return null;

  let best: PatientFacilityBillDetails = byCode[0];
  let bestRanked = -1;
  for (const line of byCode) {
    const score = scoreBillableServiceMatch(line.billable_service, serviceHint);
    const price = Number(line.item_price ?? 0) || 0;
    // Name match dominates; among ties prefer higher item_price.
    const ranked = score * 1_000_000 + price;
    if (ranked > bestRanked) {
      bestRanked = ranked;
      best = line;
    }
  }
  return best;
}

export function unitPriceFromBillLine(line: PatientFacilityBillDetails | null | undefined): string {
  if (!line) return '';
  const price = line.item_price ?? line.item_total_price;
  if (price == null || price === ('' as unknown)) return '';
  const n = Number(price);
  return Number.isFinite(n) ? String(n) : String(price).trim();
}

/** SHA coverage flags for an intervention_code (from interventions coverage API). */
export type ShaInterventionPreauthFlags = {
  needsPreauth: boolean;
  needsManualPreauthApproval: boolean;
  intervention?: Intervention | null;
};

/**
 * Bill lines that need elective preauth (`needsManualPreauthApproval`) and are not yet approved.
 */
export const needsElectivePreauth = (item: PatientFacilityBillDetails): boolean => {
  if (!item?.intervention_code) {
    return false;
  }
  if (asBool(item.preauth_approved)) {
    return false;
  }
  if (item.elective_preauth != null) {
    return asBool(item.elective_preauth);
  }
  return false;
};

/**
 * Bill lines that need normal (non-elective) preauth and are not yet approved.
 * Prefer ETL flags when present; otherwise use SHA intervention coverage for the
 * bill's `intervention_code` (`needsPreauth` && !`needsManualPreauthApproval`).
 * @see https://hie-docs.dha.go.ke/docs/claims/process/preauths/normalPreauths
 */
export const needsNormalPreauth = (
  item: PatientFacilityBillDetails,
  sha?: ShaInterventionPreauthFlags | null,
): boolean => {
  if (!item?.intervention_code) {
    return false;
  }
  if (asBool(item.preauth_approved)) {
    return false;
  }
  // Elective is a separate queue / workspace mode
  if (asBool(item.elective_preauth)) {
    return false;
  }
  // Prefer explicit ETL flags when the bill payload includes them
  if (item.requires_preauth != null) {
    return asBool(item.requires_preauth) && !asBool(item.elective_preauth);
  }
  if (item.normal_preauth != null) {
    return asBool(item.normal_preauth);
  }
  // Facility bill lines often omit ETL flags — use SHA coverage for intervention_code
  if (sha) {
    return Boolean(sha.needsPreauth) && !Boolean(sha.needsManualPreauthApproval);
  }
  return false;
};

/**
 * Resolve normal-preauth need for a bill line via SHA interventions coverage
 * using `cr_no` + `intervention_code` (+ optional `subBenefitCode` from claim visit).
 */
export async function resolveNormalPreauthForBillItem(
  item: PatientFacilityBillDetails,
  locationUuid: string,
  subBenefitCode?: string,
): Promise<ShaInterventionPreauthFlags | null> {
  const code = (item.intervention_code ?? '').trim();
  const patientId = (item.cr_no ?? '').trim();
  if (!code || !patientId || !locationUuid) {
    return null;
  }
  try {
    const intervention = await fetchShaInterventionByCode(
      patientId,
      locationUuid,
      code,
      subBenefitCode,
    );
    if (!intervention) {
      return { needsPreauth: false, needsManualPreauthApproval: false, intervention: null };
    }
    return {
      needsPreauth: Boolean(intervention.needsPreauth),
      needsManualPreauthApproval: Boolean(intervention.needsManualPreauthApproval),
      intervention,
    };
  } catch {
    return null;
  }
}

export async function fetchActiveVisitForPatient(patientUuid: string, locationUuid?: string): Promise<Visit | null> {
  if (!patientUuid) {
    return null;
  }
  const params = new URLSearchParams({
    patient: patientUuid,
    includeInactive: 'false',
    fromStartDate: dayjs().startOf('day').toISOString(),
    v: 'full',
    limit: '1',
  });
  if (locationUuid) {
    params.set('location', locationUuid);
  }
  const response = await openmrsFetch(`${restBaseUrl}/visit?${params.toString()}`);
  const results = response?.data?.results as Visit[] | undefined;
  return results?.[0] ?? null;
}

export async function fetchNormalPreauthBillItems(
  locationUuid: string,
  billingDate: string,
): Promise<PatientFacilityBillDetails[]> {
  const results = await fetchFacilityPreauthBills({ locationUuid, billingDate });
  // Dedicated `/facility/pre-auth-bills` already returns preauth candidates; still drop
  // elective / already-approved / lines without an intervention code.
  return (results ?? []).filter((item) => {
    if (!item?.intervention_code) return false;
    if (asBool(item.preauth_approved)) return false;
    if (asBool(item.elective_preauth)) return false;
    if (item.requires_preauth != null || item.normal_preauth != null) {
      return needsNormalPreauth(item);
    }
    return true;
  });
}

export async function fetchElectivePreauthBillItems(
  locationUuid: string,
  billingDate: string,
): Promise<PatientFacilityBillDetails[]> {
  const results = await fetchFacilityPreauthBills({ locationUuid, billingDate });
  return (results ?? []).filter((item) => needsElectivePreauth(item));
}

export async function fetchPreauthBillItems(
  locationUuid: string,
  billingDate: string,
): Promise<PatientFacilityBillDetails[]> {
  const results = await fetchFacilityPreauthBills({ locationUuid, billingDate });
  return (results ?? []).filter((item) => {
    if (!item?.intervention_code) return false;
    if (asBool(item.preauth_approved)) return false;
    if (asBool(item.elective_preauth)) return true;
    if (item.requires_preauth != null || item.normal_preauth != null) {
      return needsNormalPreauth(item);
    }
    return true;
  });
}

export function resolveConsentTokenForVisit(visit: Visit | null | undefined): string {
  if (!visit) return '';
  return getConsentToken(visit);
}

export function storePreauthCode(consentToken: string, interventionCode: string, preauthCode: string) {
  try {
    const raw = sessionStorage.getItem(PREAUTH_CODE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[`${consentToken}::${interventionCode}`] = preauthCode;
    sessionStorage.setItem(PREAUTH_CODE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getStoredPreauthCode(consentToken: string, interventionCode: string): string | undefined {
  try {
    const raw = sessionStorage.getItem(PREAUTH_CODE_KEY);
    if (!raw) return undefined;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[`${consentToken}::${interventionCode}`];
  } catch {
    return undefined;
  }
}

export function parseDocTypes(csv?: string | null): string[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function interventionFlagsFromBillItem(item: PatientFacilityBillDetails) {
  return {
    code: item.intervention_code,
    ...readSpecialtyFlags(item),
    requiredPreauthDocumentTypes: parseDocTypes(item.required_preauth_document_types),
    applicableDocumentTypes: parseDocTypes(item.applicable_document_types),
  };
}

/** Specialty flags from visit/SHA/bill payloads (snake_case or camelCase). */
export function readSpecialtyFlags(source: unknown): {
  requiresSurgicalPreauth: boolean;
  requiresRenalPreauth: boolean;
  requiresOncologyPreauth: boolean;
  requiresRadiologyPreauth: boolean;
  requiresOpticalPreauth: boolean;
} {
  const s = (source ?? {}) as Record<string, unknown>;
  return {
    requiresSurgicalPreauth: asBool(s.requiresSurgicalPreauth ?? s.requires_surgical_preauth),
    requiresRenalPreauth: asBool(s.requiresRenalPreauth ?? s.requires_renal_preauth),
    requiresOncologyPreauth: asBool(s.requiresOncologyPreauth ?? s.requires_oncology_preauth),
    requiresRadiologyPreauth: asBool(s.requiresRadiologyPreauth ?? s.requires_radiology_preauth),
    requiresOpticalPreauth: asBool(s.requiresOpticalPreauth ?? s.requires_optical_preauth),
  };
}

export function mergeSpecialtyFlags(
  ...sources: Array<ReturnType<typeof readSpecialtyFlags> | null | undefined>
): ReturnType<typeof readSpecialtyFlags> {
  return sources.reduce(
    (acc, src) => ({
      requiresSurgicalPreauth: acc.requiresSurgicalPreauth || !!src?.requiresSurgicalPreauth,
      requiresRenalPreauth: acc.requiresRenalPreauth || !!src?.requiresRenalPreauth,
      requiresOncologyPreauth: acc.requiresOncologyPreauth || !!src?.requiresOncologyPreauth,
      requiresRadiologyPreauth: acc.requiresRadiologyPreauth || !!src?.requiresRadiologyPreauth,
      requiresOpticalPreauth: acc.requiresOpticalPreauth || !!src?.requiresOpticalPreauth,
    }),
    {
      requiresSurgicalPreauth: false,
      requiresRenalPreauth: false,
      requiresOncologyPreauth: false,
      requiresRadiologyPreauth: false,
      requiresOpticalPreauth: false,
    },
  );
}

export function preauthFormLabel(flags: {
  requiresSurgicalPreauth?: boolean;
  requiresRenalPreauth?: boolean;
  requiresOncologyPreauth?: boolean;
  requiresRadiologyPreauth?: boolean;
  requiresOpticalPreauth?: boolean;
}): string {
  if (flags.requiresSurgicalPreauth) return 'Surgical';
  if (flags.requiresRenalPreauth) return 'Renal';
  if (flags.requiresOncologyPreauth) return 'Oncology';
  if (flags.requiresRadiologyPreauth) return 'Imaging';
  if (flags.requiresOpticalPreauth) return 'Optical';
  return 'Normal';
}

export type PreauthInterventionProps = {
  code: string;
  name?: string;
  requiresSurgicalPreauth?: boolean;
  requiresRenalPreauth?: boolean;
  requiresOncologyPreauth?: boolean;
  requiresRadiologyPreauth?: boolean;
  requiresOpticalPreauth?: boolean;
  requiredPreauthDocumentTypes?: string[];
  applicableDocumentTypes?: string[];
};

export const GENERATABLE_DOC_TYPES = new Set(['DISCHARGE_SUMMARY', 'INVOICE', 'FINAL_BILL']);

export type OpenMrsProviderHit = {
  uuid: string;
  display: string;
  identifier?: string;
  /** From provider attribute type PROVIDER_NATIONAL_ID_UUID (National ID card) */
  nationalId?: string;
  person?: { display?: string; uuid?: string };
};

function extractProviderNationalId(
  attributes?: Array<{ value?: string; voided?: boolean; attributeType?: { uuid?: string } }>,
): string | undefined {
  const hit = (attributes ?? []).find(
    (a) => !a.voided && a.attributeType?.uuid === IdentifierTypesUuids.PROVIDER_NATIONAL_ID_UUID && a.value,
  );
  return hit?.value ? String(hit.value).trim() : undefined;
}

export async function searchOpenMrsProviders(q: string): Promise<OpenMrsProviderHit[]> {
  if (!q || q.trim().length < 2) {
    return [];
  }
  const url = `${restBaseUrl}/provider?q=${encodeURIComponent(q.trim())}&v=custom:(uuid,display,identifier,person:(uuid,display),attributes:(uuid,value,voided,attributeType:(uuid)))`;
  const response = await openmrsFetch(url);
  const results = (response?.data?.results as Array<OpenMrsProviderHit & { attributes?: any[] }>) ?? [];
  return results.map((p) => ({
    uuid: p.uuid,
    display: p.display,
    identifier: p.identifier,
    person: p.person,
    nationalId: extractProviderNationalId(p.attributes),
  }));
}

/** ICD-11 concept source used by AMRS / ETL patient diagnosis (claims-and-billing). */
export const ICD11_CONCEPT_SOURCE_UUID = '43aaca5f-d623-43fd-993b-673b5d927cdd';

export type DiagnosisConceptHit = {
  uuid: string;
  display: string;
  icd11Code: string;
};

type ConceptMappingLike = {
  display?: string;
  conceptReferenceTerm?: {
    code?: string;
    name?: string;
    conceptSource?: { uuid?: string; name?: string; hl7Code?: string };
  };
};

function extractIcd11CodeFromConcept(concept: {
  mappings?: ConceptMappingLike[];
}): string {
  for (const m of concept.mappings ?? []) {
    const term = m.conceptReferenceTerm;
    if (!term) continue;
    const source = term.conceptSource ?? {};
    const sourceUuid = String(source.uuid ?? '');
    const sourceName = String(source.name ?? '').toUpperCase();
    const hl7 = String(source.hl7Code ?? '').toUpperCase();
    if (
      sourceUuid === ICD11_CONCEPT_SOURCE_UUID ||
      sourceName.includes('ICD-11') ||
      sourceName.includes('ICD11') ||
      hl7 === 'ICD11' ||
      hl7.includes('ICD-11')
    ) {
      const code = String(term.code ?? '').trim();
      if (code) return code;
    }
  }
  for (const m of concept.mappings ?? []) {
    const display = String(m.display ?? '');
    if (/ICD-?11/i.test(display)) {
      const code = display.split(':').pop()?.trim();
      if (code) return code;
    }
  }
  return '';
}

/**
 * Search the OpenMRS concept dictionary for ICD-11–mapped diagnosis concepts.
 * Used when the clerk types in Raise Preauth (visit diagnoses still prefill the list).
 */
export async function searchDiagnosisConcepts(q: string): Promise<DiagnosisConceptHit[]> {
  const term = (q ?? '').trim();
  if (term.length < 2) {
    return [];
  }
  const params = new URLSearchParams({
    q: term,
    limit: '25',
    v: 'custom:(uuid,display,mappings:(display,conceptReferenceTerm:(uuid,code,name,conceptSource:(uuid,name,hl7Code))))',
  });
  const response = await openmrsFetch(`${restBaseUrl}/concept?${params.toString()}`);
  const results = (response?.data?.results as Array<{
    uuid: string;
    display: string;
    mappings?: ConceptMappingLike[];
  }>) ?? [];

  const hits: DiagnosisConceptHit[] = [];
  const seen = new Set<string>();
  for (const c of results) {
    const icd11Code = extractIcd11CodeFromConcept(c);
    if (!icd11Code) continue;
    const key = `${icd11Code}|${c.uuid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({
      uuid: c.uuid,
      display: c.display || icd11Code,
      icd11Code,
    });
  }
  return hits;
}

export type HwrSearchResult = {
  membership?: {
    id?: string;
    full_name?: string;
    registration_id?: string;
    licensing_body?: string;
    specialty?: string;
    status?: string;
  };
  contacts?: { email?: string; phone?: string };
  identifiers?: {
    identification_type?: string;
    identification_number?: string;
    client_registry_id?: string;
  };
};

/** GET {hieBaseUrl}/practitioner/search */
export async function searchHealthWorkerRegistry(params: {
  identifierType: string;
  identifierValue: string;
  locationUuid: string;
}): Promise<HwrSearchResult[]> {
  const { getHieBaseUrl } = await import('../../../../claims/utils');
  const { hieBaseUrl } = await getHieBaseUrl();
  const qs = new URLSearchParams({
    identifierType: params.identifierType,
    identifierValue: params.identifierValue,
    locationUuid: params.locationUuid,
  });
  const response = await openmrsFetch(`${hieBaseUrl}/practitioner/search?${qs.toString()}`);
  const data = response?.data;
  if (Array.isArray(data)) {
    // Backend may return HealthWokerApiResponse[] with { message } wrappers
    return data.map((row: any) => row?.message ?? row).filter(Boolean);
  }
  if (data?.message) {
    return [data.message];
  }
  return data ? [data] : [];
}

export function billingDateToVisitDate(billDate?: string): string {
  if (!billDate) {
    return dayjs().format('YYYY-MM-DD');
  }
  // "2026-07-23 12:16" or ISO
  const d = dayjs(billDate);
  return d.isValid() ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
}

/**
 * Load patient facility bill lines and resolve unit_price for the intervention.
 * Handles multiple lines sharing one intervention_code by matching billable_service.
 */
export async function resolveUnitPriceFromPatientBills(params: {
  patientUuid: string;
  locationUuid: string;
  billingDate?: string;
  interventionCode: string;
  serviceHint?: string | null;
}): Promise<{ unitPrice: string; billLine: PatientFacilityBillDetails | null }> {
  const patientUuid = (params.patientUuid ?? '').trim();
  const locationUuid = (params.locationUuid ?? '').trim();
  const interventionCode = (params.interventionCode ?? '').trim();
  if (!patientUuid || !locationUuid || !interventionCode) {
    return { unitPrice: '', billLine: null };
  }
  try {
    const billingDate = billingDateToVisitDate(params.billingDate);
    const bills = await fetchPatientFacilityBillDetails({
      patientUuid,
      locationUuid,
      billingDate,
    });
    const line = pickBillLineForIntervention(bills ?? [], interventionCode, params.serviceHint);
    return { unitPrice: unitPriceFromBillLine(line), billLine: line };
  } catch {
    return { unitPrice: '', billLine: null };
  }
}

/** Build service_start/service_end ISO. `timeOrEndOfDay` may be "HH:mm" / "HH:mm:ss", or true for end-of-day. */
export function dateToServiceIso(date: Date | undefined, timeOrEndOfDay: string | boolean = false): string {
  if (!date || Number.isNaN(date.getTime())) {
    return dayjs().format('YYYY-MM-DDTHH:mm:ssZ');
  }
  if (typeof timeOrEndOfDay === 'string') {
    const parts = timeOrEndOfDay.split(':').map((p) => Number(p));
    const [h = 0, m = 0, s = 0] = parts;
    return dayjs(date).hour(h).minute(m).second(s).format('YYYY-MM-DDTHH:mm:ssZ');
  }
  const d = timeOrEndOfDay
    ? dayjs(date).hour(23).minute(59).second(0)
    : dayjs(date).hour(8).minute(0).second(0);
  return d.format('YYYY-MM-DDTHH:mm:ssZ');
}

/** POC Pre-authorization Form encounter type. */
export const PREAUTH_ENCOUNTER_TYPE_UUID = '18b10189-a89f-430d-83e9-14663fef258c';

/** Clinical notes / indications concept — same UUID as admissions clinical notes. */
export const CLINICAL_INDICATIONS_CONCEPT_UUID = '5e4dc798-2cce-4a1a-97e9-bcf22d64b07c';

export const PREAUTH_FORM_CONCEPTS = {
  clinicalIndication: CLINICAL_INDICATIONS_CONCEPT_UUID,
  startDate: 'bb85532e-8f7e-476f-81d7-5580e0385852',
  sessionNumber: '86f4e2e2-c2e8-4d0b-9ed7-34900d55ae09',
  frequencyOfSessions: 'a40396d3-3f9b-49b6-902a-a804f3d0e2a0',
  complaintGroup: '9014962e-3efe-46b0-a393-c8c8bddadaa7',
  complaint: 'a8a6ddb6-1350-11df-a1f1-0026b9348838',
  otherComplaint: 'a8a06fc6-1350-11df-a1f1-0026b9348838',
  hpi: '9e903280-385f-473d-9dfb-01bdb6b661a5',
  generalExam: 'a8a0cc32-1350-11df-a1f1-0026b9348838',
  investigation: '7b64016c-ae2d-4ec1-bdc1-e920b0e94b9d',
  anaesthesia: '2ea4944e-51e4-52c7-a209-8dcc2e889054',
  employmentRelated: '7dcf0456-a9ec-42d3-aa75-d406d3e5abb1',
  accidentRelated: '855b3a01-53c9-4129-923d-79863d318580',
  coInsured: '415dbca0-2d9b-4d6a-98b7-b855a023cbbb',
  coInsuredDetails: '226c4f3a-3db3-4244-adc3-bc224b90d8fe',
  yes: 'a899b35c-1350-11df-a1f1-0026b9348838',
  no: 'a899b42e-1350-11df-a1f1-0026b9348838',
} as const;

const FREQUENCY_CONCEPT_TO_HIE: Record<string, string> = {
  // Confirmed from live PREAUTHORIZATION encounter (ONCE A WEEK)
  '5dcfe297-2ef7-4f1c-97e3-a519c18fcc84': 'ONCE_A_WEEK',
  '690b2ab2-4cbc-4df4-be19-64b8a93981ab': 'ONCE_EVERY_2_WEEKS',
  '72ec1de0-4bf0-4c40-9329-b8f574a64132': 'ONCE_EVERY_3_WEEKS',
  'a899d7f6-1350-11df-a1f1-0026b9348838': 'ONCE_A_MONTH',
};

function mapFrequencyFromObs(obs: Record<string, unknown> | undefined): string {
  if (!obs) return '';
  const uuid = codedUuid(obs.value);
  if (uuid && FREQUENCY_CONCEPT_TO_HIE[uuid]) {
    return FREQUENCY_CONCEPT_TO_HIE[uuid];
  }
  // Fallback when form schema used placeholder UUIDs but display names are correct
  const display = codedDisplay(obs.value).toUpperCase().replace(/\s+/g, ' ');
  if (!display) return '';
  if (display.includes('TWICE') && display.includes('WEEK')) return 'TWICE_A_WEEK';
  if (
    (display.includes('ONCE') || display.includes('ONE TIME') || display.includes('EVERY')) &&
    display.includes('WEEK') &&
    !display.includes('2') &&
    !display.includes('3')
  ) {
    return 'ONCE_A_WEEK';
  }
  if (display.includes('2 WEEK') || display.includes('EVERY 2')) return 'ONCE_EVERY_2_WEEKS';
  if (display.includes('3 WEEK') || display.includes('EVERY 3')) return 'ONCE_EVERY_3_WEEKS';
  if (display.includes('MONTH')) return 'ONCE_A_MONTH';
  return '';
}

const ANAESTHESIA_CONCEPT_TO_HIE: Record<string, string> = {
  '7a69a31a-d88f-4ebd-a00b-cb5b4581de00': 'GENERAL',
  '074225d4-b1be-56e9-93f6-255ebf106df3': 'LOCAL',
  '3fa5c3a8-41e5-493a-9ab7-7177fc6f8c82': 'SEDATION',
  'f45ac884-e73e-4b02-9d8b-49c4e3ce5a15': 'SPINAL',
};

/** In-memory cache for concept UUID → display (complaint answers, etc.). */
const conceptDisplayCache = new Map<string, string>();

async function fetchConceptDisplay(conceptUuid: string): Promise<string> {
  const uuid = (conceptUuid ?? '').trim();
  if (!uuid) return '';
  if (conceptDisplayCache.has(uuid)) {
    return conceptDisplayCache.get(uuid) ?? '';
  }
  try {
    const res = await openmrsFetch(
      `${restBaseUrl}/concept/${uuid}?v=custom:(uuid,display,name:(display))`,
    );
    const data = res?.data as { display?: string; name?: { display?: string } } | undefined;
    const display = String(data?.display ?? data?.name?.display ?? '').trim();
    conceptDisplayCache.set(uuid, display);
    return display;
  } catch {
    conceptDisplayCache.set(uuid, '');
    return '';
  }
}

async function resolveChiefComplaintFromObs(obsList: Record<string, unknown>[]): Promise<string> {
  const C = PREAUTH_FORM_CONCEPTS;
  const labels: string[] = [];
  const missingUuids: string[] = [];

  for (const obs of obsList) {
    if (conceptUuidOf(obs) !== C.complaint) continue;
    const uuid = codedUuid(obs.value);
    const fromObs = codedDisplay(obs.value) || obsTextValue(obs);
    if (fromObs) {
      labels.push(fromObs);
    } else if (uuid) {
      missingUuids.push(uuid);
    }
  }

  if (missingUuids.length) {
    const unique = [...new Set(missingUuids)];
    const fetched = await Promise.all(unique.map((u) => fetchConceptDisplay(u)));
    const byUuid = new Map(unique.map((u, i) => [u, fetched[i]]));
    for (const uuid of missingUuids) {
      const label = byUuid.get(uuid) ?? '';
      if (label) labels.push(label);
    }
  }

  for (const obs of obsList) {
    if (conceptUuidOf(obs) !== C.otherComplaint) continue;
    const other = obsTextValue(obs);
    if (other) labels.push(other);
  }

  return [...new Set(labels)].join('; ');
}

export type PreauthFormFieldKey =
  | 'clinicalIndications'
  | 'startDate'
  | 'sessionsRequired'
  | 'frequency'
  | 'chiefComplaint'
  | 'hpi'
  | 'physicalExam'
  | 'investigations'
  | 'anaesthesia'
  | 'surgeryDate'
  | 'relatedToEmployment'
  | 'relatedToAccident'
  | 'isCoInsured'
  | 'coInsuranceDetails';

export type PreauthFormValues = {
  clinicalIndications: string;
  startDate: string;
  sessionsRequired: string;
  frequency: string;
  chiefComplaint: string;
  hpi: string;
  physicalExam: string;
  investigations: string;
  anaesthesia: string;
  surgeryDate: string;
  relatedToEmployment: boolean | null;
  relatedToAccident: boolean | null;
  isCoInsured: boolean | null;
  coInsuranceDetails: string;
  /** Keys that had a real value from the form / obs. */
  found: Set<PreauthFormFieldKey>;
  source: 'encounter' | 'obs' | 'none';
};

function emptyPreauthFormValues(source: PreauthFormValues['source'] = 'none'): PreauthFormValues {
  return {
    clinicalIndications: '',
    startDate: '',
    sessionsRequired: '',
    frequency: '',
    chiefComplaint: '',
    hpi: '',
    physicalExam: '',
    investigations: '',
    anaesthesia: '',
    surgeryDate: '',
    relatedToEmployment: null,
    relatedToAccident: null,
    isCoInsured: null,
    coInsuranceDetails: '',
    found: new Set(),
    source,
  };
}

function conceptUuidOf(obs: Record<string, unknown>): string {
  const c = obs.concept;
  if (typeof c === 'string') return c;
  if (c && typeof c === 'object' && 'uuid' in c) return String((c as { uuid: string }).uuid ?? '');
  return '';
}

function codedUuid(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'uuid' in value) {
    return String((value as { uuid: string }).uuid ?? '');
  }
  return '';
}

function codedDisplay(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const v = value as { display?: string; name?: { display?: string } };
  return String(v.display ?? v.name?.display ?? '').trim();
}

function obsTextValue(obs: Record<string, unknown> | null | undefined): string {
  if (!obs) return '';
  if (typeof obs.valueText === 'string' && obs.valueText.trim()) {
    return obs.valueText.trim();
  }
  const value = obs.value;
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
}

function obsNumericValue(obs: Record<string, unknown> | null | undefined): string {
  if (!obs) return '';
  const value = obs.value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return value.trim();
  return obsTextValue(obs);
}

function obsDateIso(obs: Record<string, unknown> | null | undefined): string {
  if (!obs) return '';
  const raw =
    (typeof obs.valueDate === 'string' && obs.valueDate) ||
    (typeof obs.valueDatetime === 'string' && obs.valueDatetime) ||
    (typeof obs.value === 'string' && obs.value) ||
    '';
  const d = dayjs(raw);
  return d.isValid() ? d.format('YYYY-MM-DDTHH:mm:ssZ') : '';
}

function obsYesNo(obs: Record<string, unknown> | null | undefined): boolean | null {
  if (!obs) return null;
  const uuid = codedUuid(obs.value);
  if (uuid === PREAUTH_FORM_CONCEPTS.yes) return true;
  if (uuid === PREAUTH_FORM_CONCEPTS.no) return false;
  return null;
}

function flattenObs(obsList: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const item of obsList ?? []) {
    if (!item || typeof item !== 'object') continue;
    const obs = item as Record<string, unknown>;
    out.push(obs);
    const groupMembers = obs.groupMembers ?? obs.group_members;
    if (Array.isArray(groupMembers)) {
      out.push(...flattenObs(groupMembers));
    }
  }
  return out;
}

function latestObsByConcept(obsList: Record<string, unknown>[]): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  const sorted = [...obsList].sort((a, b) => {
    const ta = dayjs(String(a.obsDatetime ?? '')).valueOf() || 0;
    const tb = dayjs(String(b.obsDatetime ?? '')).valueOf() || 0;
    return tb - ta;
  });
  for (const obs of sorted) {
    const cu = conceptUuidOf(obs);
    if (cu && !map.has(cu)) {
      map.set(cu, obs);
    }
  }
  return map;
}

function markFound(values: PreauthFormValues, key: PreauthFormFieldKey, present: boolean) {
  if (present) values.found.add(key);
}

async function mapObsToPreauthFormValues(
  obsList: Record<string, unknown>[],
  source: PreauthFormValues['source'],
  surgeryDateFromEncounter?: string,
): Promise<PreauthFormValues> {
  const values = emptyPreauthFormValues(source);
  const byConcept = latestObsByConcept(obsList);
  const C = PREAUTH_FORM_CONCEPTS;

  const clinical = obsTextValue(byConcept.get(C.clinicalIndication));
  values.clinicalIndications = clinical;
  markFound(values, 'clinicalIndications', Boolean(clinical));

  const start = obsDateIso(byConcept.get(C.startDate));
  values.startDate = start;
  markFound(values, 'startDate', Boolean(start));

  const sessions = obsNumericValue(byConcept.get(C.sessionNumber));
  values.sessionsRequired = sessions;
  // Keep "0" as a valid found value (Boolean("0") is true; avoid treating empty only).
  markFound(values, 'sessionsRequired', sessions !== '');

  const freqObs = byConcept.get(C.frequencyOfSessions);
  const frequency = mapFrequencyFromObs(freqObs);
  values.frequency = frequency;
  markFound(values, 'frequency', Boolean(frequency));

  values.chiefComplaint = await resolveChiefComplaintFromObs(obsList);
  markFound(values, 'chiefComplaint', Boolean(values.chiefComplaint));

  const hpi = obsTextValue(byConcept.get(C.hpi));
  values.hpi = hpi;
  markFound(values, 'hpi', Boolean(hpi));

  const exam = obsTextValue(byConcept.get(C.generalExam));
  values.physicalExam = exam;
  markFound(values, 'physicalExam', Boolean(exam));

  const inv = obsTextValue(byConcept.get(C.investigation));
  values.investigations = inv;
  markFound(values, 'investigations', Boolean(inv));

  const anaObs = byConcept.get(C.anaesthesia);
  const anaUuid = codedUuid(anaObs?.value);
  const anaesthesia = ANAESTHESIA_CONCEPT_TO_HIE[anaUuid] ?? '';
  values.anaesthesia = anaesthesia;
  markFound(values, 'anaesthesia', Boolean(anaesthesia));

  if (surgeryDateFromEncounter) {
    values.surgeryDate = surgeryDateFromEncounter;
    markFound(values, 'surgeryDate', true);
  }

  const emp = obsYesNo(byConcept.get(C.employmentRelated));
  values.relatedToEmployment = emp;
  markFound(values, 'relatedToEmployment', emp !== null);

  const acc = obsYesNo(byConcept.get(C.accidentRelated));
  values.relatedToAccident = acc;
  markFound(values, 'relatedToAccident', acc !== null);

  const co = obsYesNo(byConcept.get(C.coInsured));
  values.isCoInsured = co;
  markFound(values, 'isCoInsured', co !== null);

  const coDetails = obsTextValue(byConcept.get(C.coInsuredDetails));
  values.coInsuranceDetails = coDetails;
  markFound(values, 'coInsuranceDetails', Boolean(coDetails));

  return values;
}

async function fetchLatestObsForConcept(
  patientUuid: string,
  conceptUuid: string,
): Promise<Record<string, unknown>[]> {
  try {
    const qs = new URLSearchParams({
      patient: patientUuid,
      concept: conceptUuid,
      v: 'custom:(uuid,obsDatetime,concept:(uuid),value,valueText,valueDate,valueDatetime,groupMembers:(uuid,obsDatetime,concept:(uuid),value,valueText))',
      limit: '50',
    });
    const res = await openmrsFetch(`${restBaseUrl}/obs?${qs.toString()}`);
    return (res?.data?.results ?? []) as Record<string, unknown>[];
  } catch {
    return [];
  }
}

async function fetchLatestPreauthEncounter(patientUuid: string): Promise<Record<string, unknown> | null> {
  try {
    const qs = new URLSearchParams({
      patient: patientUuid,
      encounterType: PREAUTH_ENCOUNTER_TYPE_UUID,
      v: 'full',
      limit: '20',
    });
    const res = await openmrsFetch(`${restBaseUrl}/encounter?${qs.toString()}`);
    const results = (res?.data?.results ?? []) as Record<string, unknown>[];
    if (!results.length) return null;
    const sorted = [...results].sort((a, b) => {
      const ta = dayjs(String(a.encounterDatetime ?? '')).valueOf() || 0;
      const tb = dayjs(String(b.encounterDatetime ?? '')).valueOf() || 0;
      return tb - ta;
    });
    let encounter = sorted[0] ?? null;
    if (!encounter) return null;

    // List endpoints sometimes omit nested obs even with v=full — reload by uuid.
    const obs = encounter.obs;
    if (!Array.isArray(obs) || obs.length === 0) {
      const id = String(encounter.uuid ?? '');
      if (id) {
        try {
          const full = await openmrsFetch(`${restBaseUrl}/encounter/${id}?v=full`);
          if (full?.data && typeof full.data === 'object') {
            encounter = full.data as Record<string, unknown>;
          }
        } catch {
          // keep list representation
        }
      }
    }
    return encounter;
  } catch {
    return null;
  }
}

/**
 * Prefill values from POC Pre-authorization Form:
 * 1) latest PREAUTHORIZATION encounter obs
 * 2) else latest obs per concept
 */
export async function fetchPreauthFormValues(patientUuid: string): Promise<PreauthFormValues> {
  const uuid = (patientUuid ?? '').trim();
  if (!uuid) return emptyPreauthFormValues('none');

  const encounter = await fetchLatestPreauthEncounter(uuid);
  if (encounter) {
    const obs = flattenObs(Array.isArray(encounter.obs) ? encounter.obs : []);
    const surgeryRaw = String(encounter.encounterDatetime ?? '');
    const surgeryDate = dayjs(surgeryRaw).isValid()
      ? dayjs(surgeryRaw).format('YYYY-MM-DDTHH:mm:ssZ')
      : '';
    const fromEncounter = await mapObsToPreauthFormValues(obs, 'encounter', surgeryDate);
    if (fromEncounter.found.size > 0) {
      return fromEncounter;
    }
    // Encounter present but no mappable obs — fall through to per-concept latest
  }

  const conceptList = [
    PREAUTH_FORM_CONCEPTS.clinicalIndication,
    PREAUTH_FORM_CONCEPTS.startDate,
    PREAUTH_FORM_CONCEPTS.sessionNumber,
    PREAUTH_FORM_CONCEPTS.frequencyOfSessions,
    PREAUTH_FORM_CONCEPTS.complaintGroup,
    PREAUTH_FORM_CONCEPTS.complaint,
    PREAUTH_FORM_CONCEPTS.otherComplaint,
    PREAUTH_FORM_CONCEPTS.hpi,
    PREAUTH_FORM_CONCEPTS.generalExam,
    PREAUTH_FORM_CONCEPTS.investigation,
    PREAUTH_FORM_CONCEPTS.anaesthesia,
    PREAUTH_FORM_CONCEPTS.employmentRelated,
    PREAUTH_FORM_CONCEPTS.accidentRelated,
    PREAUTH_FORM_CONCEPTS.coInsured,
    PREAUTH_FORM_CONCEPTS.coInsuredDetails,
  ];

  const batches = await Promise.all(conceptList.map((c) => fetchLatestObsForConcept(uuid, c)));
  const allObs = flattenObs(batches.flat());
  if (!allObs.length) return emptyPreauthFormValues(encounter ? 'encounter' : 'none');
  return mapObsToPreauthFormValues(allObs, 'obs');
}

/**
 * Latest OpenMRS obs for the clinical-indications concept for a patient.
 * Soft-fails to '' if missing or the request errors.
 */
export async function fetchLatestClinicalIndicationsObs(patientUuid: string): Promise<string> {
  const values = await fetchPreauthFormValues(patientUuid);
  return values.clinicalIndications;
}

/** Reusable preauth status check — prefer these over calling getPreauthPreview directly. */
export {
  checkPreauthStatus,
  usePreauthPreview,
  isPreauthFinalised,
  isPreauthTerminalFailure,
  invalidatePreauthPreview,
  preauthPreviewSwrKey,
  type PreauthCheckKind,
  type PreauthCheckResult,
} from '../../../../claims/claims.resource';
