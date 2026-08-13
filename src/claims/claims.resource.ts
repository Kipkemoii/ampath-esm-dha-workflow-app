import useSWR, { mutate as globalMutate } from 'swr';
import dayjs from 'dayjs';
import {
  ServiceType,
  type BenefitUtilization,
  type InterventionResults,
  type ClaimResult,
  type Intervention,
  VisitType,
  type ClientSubBenefit,
  PomsfBalance,
  PreExistingIntervention,
  PreauthRequest,
} from './index';
import { fetchUrl, getHieBaseUrl, getUrl, useHie } from './utils';
import { openmrsFetch, restBaseUrl, useConfig, useSession, Visit } from '@openmrs/esm-framework';
import { Order } from '@openmrs/esm-patient-common-lib';
import { useProviderClaimPreview } from '../billing/billing-claims.resource';
import { getAuthorizations } from '../registry/hie.resource';

export const useClientSubBenefits = (clientRegistryId: string) => {
  const { hieBaseUrl, locationUuid } = useHie();
  const url = clientRegistryId
    ? `${hieBaseUrl}/sub-benefits?patient_id=${clientRegistryId}&locationUuid=${locationUuid}`
    : null;

  const { data, error, isLoading } = useSWR<{ data: Array<ClientSubBenefit> }>(url, openmrsFetch);

  const results = data?.data;

  return {
    clientSubBenefits: results,
    error,
    isLoadingClientSubBenefits: isLoading,
  };
};

export const useInterventions = (clientRegistryId: string, subBenefitCode: string) => {
  const { hieBaseUrl, locationUuid } = useHie();
  const url =
    clientRegistryId && subBenefitCode
      ? `${hieBaseUrl}/interventions?patient_id=${clientRegistryId}&locationUuid=${locationUuid}&sub_benefit_code=${subBenefitCode}`
      : null;

  const { data, error, isLoading } = useSWR<{ data: Array<Intervention> }>(url, openmrsFetch);

  const results = data?.data;

  return {
    interventions: results,
    error,
    isLoadingInterventions: isLoading,
  };
};

/**
 * Fetch patient sub-benefits (required by hie-saf interventions proxy).
 */
export async function fetchClientSubBenefits(patientId: string, locationUuid: string): Promise<ClientSubBenefit[]> {
  if (!patientId || !locationUuid) {
    return [];
  }
  const { hieBaseUrl } = await getHieBaseUrl();
  const params = new URLSearchParams({
    patient_id: patientId,
    locationUuid,
  });
  const response = await openmrsFetch(`${hieBaseUrl}/sub-benefits?${params.toString()}`);
  const data = response?.data;
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.results)) {
    return data.results;
  }
  return [];
}

function unwrapInterventions(data: unknown): Intervention[] {
  if (Array.isArray(data)) {
    return data as Intervention[];
  }
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: Intervention[] }).results;
  }
  if (data && typeof data === 'object' && 'code' in (data as object)) {
    return [data as Intervention];
  }
  return [];
}

/** Parent package prefix from an intervention code, e.g. SHA-19-239 → SHA-19 */
function interventionPackagePrefix(interventionCode: string): string {
  const parts = interventionCode.trim().toUpperCase().split('-');
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1]}`;
  }
  return interventionCode.trim().toUpperCase();
}

/**
 * Look up a single SHA intervention by code via interventions coverage.
 * hie-saf requires `sub_benefit_code`; we resolve it from the patient's sub-benefits,
 * preferring packages that match the intervention prefix (SHA-19-239 → SHA-19…).
 * Response includes `needsPreauth` / `needsManualPreauthApproval`.
 * @see https://hie-docs.dha.go.ke/docs/claims/process/preauths/normalPreauths
 */
export async function fetchShaInterventionByCode(
  patientId: string,
  locationUuid: string,
  interventionCode: string,
  subBenefitCode?: string,
): Promise<Intervention | null> {
  if (!patientId || !locationUuid || !interventionCode) {
    return null;
  }
  const { hieBaseUrl } = await getHieBaseUrl();
  const code = interventionCode.trim().toUpperCase();
  const prefix = interventionPackagePrefix(code);

  const tryFetch = async (sbCode: string): Promise<Intervention | null> => {
    if (!sbCode) return null;
    const params = new URLSearchParams({
      patient_id: patientId,
      locationUuid,
      sub_benefit_code: sbCode,
      code: interventionCode.trim(),
    });
    const response = await openmrsFetch(`${hieBaseUrl}/interventions?${params.toString()}`);
    const list = unwrapInterventions(response?.data);
    return list.find((i) => (i?.code ?? '').trim().toUpperCase() === code) ?? null;
  };

  if (subBenefitCode) {
    const hit = await tryFetch(subBenefitCode);
    if (hit) return hit;
  }

  const subBenefits = await fetchClientSubBenefits(patientId, locationUuid);
  if (subBenefits.length === 0) {
    return null;
  }

  const ranked = [...subBenefits].sort((a, b) => {
    const score = (s: ClientSubBenefit) => {
      const c = (s.code ?? '').toUpperCase();
      const parent = (s.parentBenefitCode ?? '').toUpperCase();
      if (c === prefix || parent === prefix) return 0;
      if (c.startsWith(`${prefix}-`) || c.startsWith(prefix)) return 1;
      return 2;
    };
    return score(a) - score(b);
  });

  for (const sb of ranked) {
    try {
      const hit = await tryFetch(sb.code);
      if (hit) return hit;
    } catch {
      // try next sub-benefit
    }
  }
  return null;
}

export const useBenefitUtilizations = (
  clientRegistryId: string,
  interventionCode: string,
  isCapitation: boolean,
  isPomsf: boolean,
) => {
  const { hieBaseUrl, locationUuid } = useHie();
  const url =
    clientRegistryId && interventionCode && !isCapitation && !isPomsf
      ? `${hieBaseUrl}/benefits-utilization?patient_id=${clientRegistryId}&locationUuid=${locationUuid}&intervention_code=${interventionCode}`
      : null;

  const { data, error, isLoading } = useSWR<{ data: Array<BenefitUtilization> }>(url, openmrsFetch);

  const results = data?.data;

  if (results && 'error' in results && 'message' in results) {
    return {
      benefitUtilizations: null,
      error,
      isLoadingClientSubBenefits: isLoading,
    };
  }

  return {
    benefitUtilizations: results,
    error,
    isLoadingBenefitUtilization: isLoading,
  };
};

export const usePomsfBalance = (clientRegistryId: string, isPomsf: boolean) => {
  const { hieBaseUrl, locationUuid } = useHie();
  const url =
    clientRegistryId && isPomsf
      ? `${hieBaseUrl}/pomsf-balance?patient_id=${clientRegistryId}&locationUuid=${locationUuid}`
      : null;

  const { data, error, isLoading } = useSWR<{ data: PomsfBalance }>(url, openmrsFetch);

  const results = data?.data;

  if (results && 'error' in results && 'message' in results) {
    return {
      pomsfBalance: null,
      error,
      isLoadingPomsfBalances: isLoading,
    };
  }

  return {
    pomsfBalance: results,
    error,
    isLoadingPomsfBalances: isLoading,
  };
};

// Promise-based counterpart to usePomsfBalance, for callers that already run
// their own useEffect (e.g. components inside this same module, which don't
// need useHie's useConfig({ externalModuleName }) lookup — that path has been
// observed to throw React error #310 when invoked from certain call sites).
export async function fetchPomsfBalance(clientRegistryId: string, locationUuid: string): Promise<PomsfBalance | null> {
  if (!clientRegistryId || !locationUuid) {
    return null;
  }
  const { hieBaseUrl } = await getHieBaseUrl();
  const url = `${hieBaseUrl}/pomsf-balance?patient_id=${clientRegistryId}&locationUuid=${locationUuid}`;
  const response = await openmrsFetch<PomsfBalance>(url);
  const results = response?.data;

  if (results && 'error' in results && 'message' in results) {
    return null;
  }

  return results ?? null;
}

export async function createClaimsVisit(
  interventionCode: string,
  crIdentifier: string,
  serviceType: ServiceType,
  locationUuid: string,
  { auth_guid, otp }: { auth_guid?: string; otp?: string } = {},
) {
  const { hieBaseUrl } = await getHieBaseUrl();
  const url = `${hieBaseUrl}/claims-visit`;

  let payload = {
    locationUuid,
    intervention_codes: [interventionCode],
    patient_id: crIdentifier,
    service_type: serviceType, // Type of service Options: CAPITATION, OUTPATIENT, INPATIENT, EMERGENCY
  };

  if (otp) {
    payload['otp'] = otp;
  }

  if (auth_guid) {
    payload['auth_guid'] = auth_guid;
  }

  const result = await openmrsFetch<ClaimResult>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    // signal: abortController.signal,
    body: payload,
  }).catch((error) => {
    const message = error?.responseBody?.message ?? '';
    if (typeof message === 'object') {
      throw `${message?.join(',')}`;
    }
    throw message;
  });

  if (result?.data && 'error' in result.data && 'message' in result.data) {
    const message = result.data.message ?? '';
    throw message;
  }

  return result.data;
}

export const usePreExistingIntervention = (patientUuid: string) => {
  const { hieBaseUrl } = useHie();
  const url = patientUuid ? `${hieBaseUrl}/bill-order/patient-claim-bill-order?patient_uuid=${patientUuid}` : null;

  const { data, error, isLoading } = useSWR<{ data: PreExistingIntervention[] }>(url, openmrsFetch);

  const results = data?.data;

  return {
    preExistingInterventions: results,
    error,
    isLoadingPreExistingIntervention: isLoading,
  };
};

export const useElectivePreauthPreview = (consentToken: string) => {
  const { sessionLocation } = useSession();
  const { hieBaseUrl } = useConfig({
    externalModuleName: '@ampath/esm-dha-workflow-app',
  });
  const url = consentToken
    ? `${hieBaseUrl}/pre-auth/preview?locationUuid=${sessionLocation?.uuid}&consentToken=${consentToken}`
    : null;

  const {
    data,
    error,
    isLoading,
    isValidating,
    mutate: mutated,
  } = useSWR<{
    data: {
      results: Array<{
        authorizationDetails: {
          interventions: Array<{
            subBenefitCode: string;
            code: string;
          }>
        },
        interventionCode: string;
      }>
    }
  }>(url, openmrsFetch, {
    errorRetryCount: 2,
  });

  const results = data?.data?.results ?? [];

  return {
    preauthRequests: results,
    error,
    isLoading,
    isValidating,
    mutated,
  };
};

export const useExistingElectiveIntervention = (patientUuid: string, order: Order) => {
  const { hieBaseUrl } = useHie();
  // b594be9a-9673-44f3-9741-b05823d4423c
  const url = patientUuid
    ? `${hieBaseUrl}/pre-auth/request?patientUuid=${patientUuid}&electivePreauth=true`
    : null;

  const { data, error, isLoading: isLoadingElPreauth } = useSWR<{
    data: Array<{
      orderNo: string;
      interventionCode: string;
      consentToken: string;
      status: string;
    }>
  }>(url, openmrsFetch);

  let results = data?.data;

  if (order && results && results.length) {
    results = results.filter(result => result.orderNo === order?.orderNumber);
  }

  let electiveIntervention = results?.[0];

  const { preauthRequests, isLoading } = useElectivePreauthPreview(electiveIntervention?.consentToken);

  let subBenefitCode = null;

  if (!isLoading && preauthRequests && preauthRequests.length) {
    subBenefitCode = preauthRequests?.find(p => p.interventionCode === electiveIntervention.interventionCode)?.authorizationDetails?.interventions?.[0]?.subBenefitCode;
  }

  return {
    interventionCode: electiveIntervention?.interventionCode,
    subBenefitCode,
    error,
    isLoadingElectiveIntervention: isLoading || isLoadingElPreauth,
  };
};

export async function updateBillOrderConsentToken(
  id: number,
  consentToken: string,
) {
  const { hieBaseUrl } = await getHieBaseUrl();
  const url = `${hieBaseUrl}/bill-order/${id}/consent-token`;

  let payload = {
    consent_token: consentToken,
  };

  const result = await openmrsFetch<any>(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: payload,
  }).catch((error) => {
    const message = error?.responseBody?.message ?? '';
    if (typeof message === 'object') {
      throw `${message?.join(',')}`;
    }
    throw message;
  });

  return result.data;
}

export const usePatientVisit = (patientUuid: string) => {
  console.log('patientUuid');
  console.log(patientUuid);
  console.log('patientUuid');
  const sessionLocation = useSession();

  const url = patientUuid
    ? `${restBaseUrl}/visit?patient=${patientUuid}&${sessionLocation?.sessionLocation?.uuid}&includeInactive=false&fromStartDate=${dayjs().startOf('day').toISOString()}&v=full&limit=1`
    : null;

  const { data, error, isLoading } = useSWR<{
    data: {
      results: Array<Visit>;
    };
  }>(url, openmrsFetch);

  return {
    data: data?.data?.results,
    error,
    isLoading,
  };
};

export type PreauthAttachmentMeta = {
  document_title: string;
  document_type: string;
  file_field_name: string;
};

/** HIE multipart file field for attachment at zero-based index. */
export const preauthAttachmentFieldName = (index: number): string => `attachments_${index}_file_blob`;

/** Parse index from attachments_N_file_blob; returns null if invalid. */
export const parsePreauthAttachmentIndex = (fieldName: string): number | null => {
  const match = /^attachments_(\d+)_file_blob$/.exec(fieldName?.trim() ?? '');
  if (!match) return null;
  return Number(match[1]);
};

/**
 * Normalize attachment metadata + files to contiguous indexes 0..n-1.
 * Ensures attachments[i].file_field_name === attachments_i_file_blob and a matching file exists.
 */
export const normalizePreauthAttachments = (
  attachments: PreauthAttachmentMeta[] = [],
  files: Record<string, File | Blob> = {},
): { attachments: PreauthAttachmentMeta[]; files: Record<string, File | Blob> } => {
  const withFiles = attachments
    .map((meta, index) => {
      const declared = meta.file_field_name || preauthAttachmentFieldName(index);
      const file = files[declared] ?? files[preauthAttachmentFieldName(index)];
      if (!file) return null;
      return { meta, file, preferredIndex: parsePreauthAttachmentIndex(declared) ?? index };
    })
    .filter(Boolean) as Array<{ meta: PreauthAttachmentMeta; file: File | Blob; preferredIndex: number }>;

  // Stable order: by declared index, then original order
  withFiles.sort((a, b) => a.preferredIndex - b.preferredIndex);

  const normalizedMeta: PreauthAttachmentMeta[] = [];
  const normalizedFiles: Record<string, File | Blob> = {};

  withFiles.forEach(({ meta, file }, index) => {
    const field = preauthAttachmentFieldName(index);
    normalizedMeta.push({
      document_title: meta.document_title,
      document_type: meta.document_type,
      file_field_name: field,
    });
    normalizedFiles[field] = file;
  });

  return { attachments: normalizedMeta, files: normalizedFiles };
};

export type PreauthFormPayload = {
  service_start: string;
  service_end: string;
  items: Array<{ unit_price: string; name?: string; quantity?: string }>;
  diagnoses: Array<{ consent_token: string; icd_code: string }>;
  doctors: Array<{
    identification_number: string;
    identification_type: string;
    regulation_body: string;
    intervention_code: string;
    is_primary: boolean;
  }>;
  attachments: PreauthAttachmentMeta[];
  provider_notification_email: string;
  locationUuid: string;
  /** Binary files keyed by file_field_name (e.g. attachments_0_file_blob) */
  files?: Record<string, File | Blob>;
  // Specialty (Postman)
  clinical_indications?: string;
  carcinoma_staging?: string;
  comorbidity?: string;
  metastases?: string[] | string;
  treatment_setting?: string[] | string;
  number_of_sessions_required?: string | number;
  cost_per_session?: string | number;
  is_co_insured?: string | boolean;
  necessity_of_service?: string;
  lens_prescription?: string;
  lens_amount?: string | number;
  eye_examination_amount?: string | number;
  frame_amount?: string | number;
  new_or_replacement?: string;
  frequency_of_sessions?: string;
  start_date?: string;
  progress_report?: string;
  expected_service_start_date?: string;
  is_condition_related_to_employment?: string | boolean;
  is_condition_related_to_auto_or_other_accident?: string | boolean;
  co_insurance_details?: string;
  chief_complaint?: string;
  vital_signs?: string;
  history_of_present_illness?: string;
  physical_examination?: string;
  investigation_report_details?: string;
  type_of_anaesthesia?: string;
  surgery_date?: string;
};

/** Build multipart for POST {hieBaseUrl}/pre-auth/normal.
 * Matches HIE curl POST /api/v1/preauths (snake_case fields + attachments_N_file_blob).
 * Attachment indexes are normalized to 0..n-1 before send.
 */
export const generatePreauthFormData = (
  payload: PreauthFormPayload,
  intervention: Pick<
    Intervention,
    | 'code'
    | 'requiresRadiologyPreauth'
    | 'requiresOncologyPreauth'
    | 'requiresOpticalPreauth'
    | 'requiresRenalPreauth'
    | 'requiresSurgicalPreauth'
  >,
  consentToken: string,
) => {
  const formData = new FormData();
  const { attachments, files } = normalizePreauthAttachments(payload.attachments, payload.files ?? {});

  formData.append('consent_token', consentToken);
  formData.append('intervention_code', intervention.code);
  formData.append('service_start', payload.service_start);
  formData.append('service_end', payload.service_end);
  formData.append('items', JSON.stringify(payload.items));
  formData.append('diagnoses', JSON.stringify(payload.diagnoses));
  formData.append('doctors', JSON.stringify(payload.doctors));
  formData.append('attachments', JSON.stringify(attachments));
  formData.append('provider_notification_email', payload.provider_notification_email);
  formData.append('locationUuid', payload.locationUuid);

  // Append in index order: attachments_0_file_blob, attachments_1_file_blob, …
  attachments.forEach((meta) => {
    const file = files[meta.file_field_name];
    if (file) {
      formData.append(meta.file_field_name, file, (file as File).name ?? meta.file_field_name);
    }
  });

  if (intervention.requiresRadiologyPreauth && payload.clinical_indications) {
    formData.append('clinical_indications', payload.clinical_indications);
  }

  /** HIE expects JSON lists for metastases / treatment_setting (e.g. `["LUNG"]`). */
  const asJsonListField = (value: string | string[] | undefined | null): string | null => {
    if (value == null) return null;
    if (Array.isArray(value)) return JSON.stringify(value);
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('[')) return trimmed;
    return JSON.stringify([trimmed]);
  };

  if (intervention.requiresOncologyPreauth) {
    if (payload.carcinoma_staging) formData.append('carcinoma_staging', payload.carcinoma_staging);
    if (payload.comorbidity) formData.append('comorbidity', payload.comorbidity);
    const metastasesJson = asJsonListField(payload.metastases);
    if (metastasesJson) formData.append('metastases', metastasesJson);
    const treatmentSettingJson = asJsonListField(payload.treatment_setting);
    if (treatmentSettingJson) formData.append('treatment_setting', treatmentSettingJson);
    if (payload.number_of_sessions_required != null) {
      formData.append('number_of_sessions_required', String(payload.number_of_sessions_required));
    }
    if (payload.cost_per_session != null) {
      formData.append('cost_per_session', String(payload.cost_per_session));
    }
    if (payload.is_co_insured != null) {
      formData.append('is_co_insured', String(payload.is_co_insured));
    }
    if (payload.start_date) formData.append('start_date', payload.start_date);
    if (payload.progress_report) formData.append('progress_report', payload.progress_report);
  }

  if (intervention.requiresOpticalPreauth) {
    if (payload.necessity_of_service) formData.append('necessity_of_service', payload.necessity_of_service);
    if (payload.lens_prescription) formData.append('lens_prescription', payload.lens_prescription);
    if (payload.lens_amount != null) formData.append('lens_amount', String(payload.lens_amount));
    if (payload.eye_examination_amount != null) {
      formData.append('eye_examination_amount', String(payload.eye_examination_amount));
    }
    if (payload.frame_amount != null) formData.append('frame_amount', String(payload.frame_amount));
    if (payload.new_or_replacement) formData.append('new_or_replacement', payload.new_or_replacement);
    if (payload.clinical_indications) formData.append('clinical_indications', payload.clinical_indications);
  }

  if (intervention.requiresRenalPreauth) {
    if (payload.number_of_sessions_required != null) {
      formData.append('number_of_sessions_required', String(payload.number_of_sessions_required));
    }
    if (payload.cost_per_session != null) {
      formData.append('cost_per_session', String(payload.cost_per_session));
    }
    if (payload.frequency_of_sessions) formData.append('frequency_of_sessions', payload.frequency_of_sessions);
    if (payload.clinical_indications) formData.append('clinical_indications', payload.clinical_indications);
    if (payload.start_date) formData.append('start_date', payload.start_date);
    if (payload.is_co_insured != null) formData.append('is_co_insured', String(payload.is_co_insured));
  }

  // Surgical clinical fields — send snake_case (HIE / gateway expects these keys)
  const hasSurgicalPayload = Boolean(
    payload.chief_complaint?.trim() ||
    payload.vital_signs?.trim() ||
    payload.history_of_present_illness?.trim() ||
    payload.physical_examination?.trim() ||
    payload.investigation_report_details?.trim() ||
    payload.type_of_anaesthesia?.trim() ||
    payload.surgery_date?.trim(),
  );
  if (intervention.requiresSurgicalPreauth || hasSurgicalPayload) {
    const chiefComplaint = (payload.chief_complaint ?? '').trim();
    const vitalSigns = (payload.vital_signs ?? '').trim();
    const historyOfPresentIllness = (payload.history_of_present_illness ?? '').trim();
    const physicalExamination = (payload.physical_examination ?? '').trim();
    const investigationReportDetails = (payload.investigation_report_details ?? '').trim();
    const typeOfAnaesthesia = (payload.type_of_anaesthesia || 'GENERAL').trim();
    const surgeryDate = (payload.surgery_date ?? '').trim();

    formData.append('chief_complaint', chiefComplaint);
    formData.append('vital_signs', vitalSigns);
    formData.append('history_of_present_illness', historyOfPresentIllness);
    formData.append('physical_examination', physicalExamination);
    formData.append('investigation_report_details', investigationReportDetails);
    formData.append('type_of_anaesthesia', typeOfAnaesthesia);
    if (surgeryDate) {
      formData.append('surgery_date', surgeryDate);
    }
    if (payload.is_condition_related_to_employment != null) {
      formData.append('is_condition_related_to_employment', String(payload.is_condition_related_to_employment));
    }
    if (payload.is_condition_related_to_auto_or_other_accident != null) {
      formData.append(
        'is_condition_related_to_auto_or_other_accident',
        String(payload.is_condition_related_to_auto_or_other_accident),
      );
    }
    if (payload.is_co_insured != null) {
      formData.append('is_co_insured', String(payload.is_co_insured));
    }
    if (payload.co_insurance_details) {
      formData.append('co_insurance_details', payload.co_insurance_details);
    }
  }

  if (payload.expected_service_start_date) {
    formData.append('expected_service_start_date', payload.expected_service_start_date);
  }

  return formData;
};

/**
 * Unwrap nested HIE / hie-saf error payloads into a single user-facing string.
 * Example body:
 * `{ "error": "{\"error\":\"Kindly note …\"}", "message": "could not create the preauthorization", "details": [...] }`
 */
export function extractHieErrorMessage(error: unknown, fallback = 'Request failed'): string {
  const tryParse = (value: string): unknown => {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  };

  const unwrap = (value: unknown, depth = 0): string => {
    if (depth > 8 || value == null) return '';
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsed = tryParse(trimmed);
        if (parsed !== undefined) {
          const nested = unwrap(parsed, depth + 1);
          if (nested) return nested;
        }
      }
      const prefixed = trimmed.match(
        /^could not create the (?:preauthorization|authorization):\s*(.+)$/i,
      );
      if (prefixed?.[1]) {
        const nested = unwrap(prefixed[1], depth + 1);
        if (nested) return nested;
      }
      return trimmed;
    }
    if (Array.isArray(value)) {
      return value
        .map((item) => unwrap(item, depth + 1))
        .filter(Boolean)
        .join('; ');
    }
    if (typeof value === 'object') {
      const o = value as Record<string, unknown>;
      const candidates = [
        unwrap(o.error, depth + 1),
        unwrap(o.details, depth + 1),
        unwrap(o.message, depth + 1),
        unwrap(o.rawMessage, depth + 1),
        unwrap(o.translatedMessage, depth + 1),
        unwrap(o.responseBody, depth + 1),
        unwrap(o.data, depth + 1),
      ].filter(Boolean);
      const kindly = candidates.find((c) => /kindly note/i.test(c));
      if (kindly) return kindly;
      // Prefer the most specific (longest) non-generic line
      const generic = /^(could not create the |failed to |request failed)/i;
      const specific = candidates.filter((c) => !generic.test(c));
      const pool = specific.length ? specific : candidates;
      return pool.sort((a, b) => b.length - a.length)[0] ?? '';
    }
    return String(value);
  };

  if (typeof error === 'string') {
    return unwrap(error) || fallback;
  }
  const e = error as { message?: unknown; responseBody?: unknown; data?: unknown } | null;
  return (
    unwrap(e?.responseBody) ||
    unwrap(e?.data) ||
    unwrap(e) ||
    unwrap(e?.message) ||
    fallback
  );
}

export async function createPreauth(
  payload: PreauthFormPayload,
  intervention: Pick<
    Intervention,
    | 'code'
    | 'requiresRadiologyPreauth'
    | 'requiresOncologyPreauth'
    | 'requiresOpticalPreauth'
    | 'requiresRenalPreauth'
    | 'requiresSurgicalPreauth'
  >,
  consentToken: string,
) {
  const { hieBaseUrl } = await getHieBaseUrl();
  const url = `${hieBaseUrl}/pre-auth/normal`;
  const formData = generatePreauthFormData(payload, intervention, consentToken);

  const result = await openmrsFetch(url, {
    method: 'POST',
    body: formData,
  }).catch((error) => {
    throw extractHieErrorMessage(error, 'Failed to create preauth');
  });

  if (result?.data && typeof result.data === 'object' && ('error' in result.data || 'message' in result.data)) {
    const body = result.data as { error?: unknown; message?: unknown; details?: unknown };
    if (body.error || (typeof body.message === 'string' && /could not create/i.test(body.message))) {
      throw extractHieErrorMessage(body, 'Failed to create preauth');
    }
  }

  return result?.data;
}

async function fetchPreauthPreview(consentToken: string, locationUuid: string) {
  const { hieBaseUrl } = await getHieBaseUrl();
  const url = `${hieBaseUrl}/pre-auth/preview?consentToken=${encodeURIComponent(consentToken)}&locationUuid=${encodeURIComponent(locationUuid)}`;
  try {
    const result = await openmrsFetch(url);
    return result?.data ?? null;
  } catch (error: any) {
    const status = error?.response?.status ?? error?.status;
    // No preauth raised yet
    if (status === 404) {
      return null;
    }
    const message = error?.responseBody?.message ?? error?.message ?? 'Failed to get preauth preview';
    if (typeof message === 'object') {
      throw `${(message as string[])?.join?.(',') ?? JSON.stringify(message)}`;
    }
    throw message;
  }
}

/**
 * Previews just asked for, and those still in flight, keyed by consent token and location.
 *
 * One dashboard load asks for the same preview from several places at once: the
 * Needs-raise queue (once per bill row, and rows of the same visit share a consent token),
 * the Status table (once per claim), the SWR hook behind a claim's interventions, and the
 * poller following a raise. Each is a round trip to the HIE, and together they were enough
 * to trip its rate limit — which fails whatever asks next rather than merely slowing it.
 *
 * So callers share one request, and its answer for a few seconds after. That window is
 * deliberately short: this is live status someone is waiting on, so the cache is here to
 * collapse a burst, not to hold an answer. Anything that changes a preauth clears it
 * (`invalidatePreauthPreview`), and the pollers ask straight past it (`force`).
 */
const PREAUTH_PREVIEW_TTL_MS = 5_000;
const preauthPreviewCache = new Map<string, { at: number; preview: unknown }>();
const preauthPreviewInFlight = new Map<string, Promise<unknown>>();
const preauthPreviewCacheKey = (consentToken: string, locationUuid: string) => `${locationUuid}|${consentToken}`;

/** Drop the burst-cached preview for one claim, so the next read goes to the HIE. */
function forgetPreauthPreview(consentToken: string, locationUuid: string) {
  preauthPreviewCache.delete(preauthPreviewCacheKey(consentToken, locationUuid));
}

export async function getPreauthPreview(
  consentToken: string,
  locationUuid: string,
  { force = false }: { force?: boolean } = {},
) {
  const key = preauthPreviewCacheKey(consentToken, locationUuid);
  if (force) {
    preauthPreviewCache.delete(key);
  } else {
    const cached = preauthPreviewCache.get(key);
    if (cached && Date.now() - cached.at < PREAUTH_PREVIEW_TTL_MS) {
      return cached.preview;
    }
    // Two callers asking at the same moment share one round trip rather than racing.
    const inFlight = preauthPreviewInFlight.get(key);
    if (inFlight) {
      return inFlight;
    }
  }

  // Failures are not cached: the entry is only written once an answer arrives, so a
  // rate-limited or dropped request doesn't stick around as this claim's status.
  const request = fetchPreauthPreview(consentToken, locationUuid)
    .then((preview) => {
      preauthPreviewCache.set(key, { at: Date.now(), preview });
      return preview;
    })
    .finally(() => {
      if (preauthPreviewInFlight.get(key) === request) {
        preauthPreviewInFlight.delete(key);
      }
    });
  preauthPreviewInFlight.set(key, request);
  return request;
}

/** Unwrap HIE preview: bare object, array, or paginated `{ results: [...] }`. */
export function unwrapPreauthPreviewItem(preview: unknown): Record<string, unknown> | null {
  const items = unwrapPreauthPreviewItems(preview);
  return items[0] ?? null;
}

/** All preauth rows from a preview response (paginated or single). */
export function unwrapPreauthPreviewItems(preview: unknown): Record<string, unknown>[] {
  if (!preview) {
    return [];
  }
  if (Array.isArray(preview)) {
    return preview.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
  }
  if (typeof preview !== 'object') {
    return [];
  }
  const p = preview as Record<string, unknown>;
  if (Array.isArray(p.results)) {
    return p.results.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
  }
  return [p];
}

const AWAITING_DOCTOR_STATUSES = new Set(['PENDING_DOCTOR_APPROVAL', 'DOCTOR_REQUEST_SENT', 'DOCTOR_REQUEST_FAILED']);

export function isAwaitingDoctorApproval(statusOrItem: string | Record<string, unknown> | null | undefined): boolean {
  if (!statusOrItem) return false;
  if (typeof statusOrItem === 'string') {
    return AWAITING_DOCTOR_STATUSES.has(statusOrItem.toUpperCase());
  }
  const status = String(statusOrItem.status ?? statusOrItem.preauth_status ?? '').toUpperCase();
  if (AWAITING_DOCTOR_STATUSES.has(status)) return true;
  const needs = statusOrItem.needsDoctorApproval === true || statusOrItem.needs_doctor_approval === true;
  const approved = statusOrItem.doctorApproved === true || statusOrItem.doctor_approved === true;
  return needs && !approved && status !== 'FINALISED' && status !== 'FINALIZED';
}

export type PreauthPreviewRow = {
  id: string;
  consentToken: string;
  status: string;
  preauthType: string;
  interventionCode: string;
  interventionName: string;
  memberName: string;
  memberIdentifier: string;
  preauthToken: string;
  doctorName: string;
  practitionerRegistrationNumber: string;
  needsDoctorApproval: boolean;
  doctorApproved: boolean;
  serviceStart: string;
  /** Payer / provider notes (e.g. clarification after automatic checks). */
  notes: string;
  raw: Record<string, unknown>;
};

/** True when payer asked for clarification / response on an already-raised preauth. */
export function isPreauthNeedsClarification(status: string): boolean {
  const s = (status || '').toUpperCase();
  return s === 'CLARIFICATION_AFTER_AUTOMATIC_CHECKS' || s === 'PENDING_CLARIFICATION' || s.includes('CLARIFICATION');
}

/** Collect note text from preview row `preauthNotes` / item `responseNote`. */
export function extractPreauthNotesFromItem(item: Record<string, unknown> | null | undefined): string {
  if (!item) return '';
  const notes = item.preauthNotes ?? item.preauth_notes;
  if (Array.isArray(notes)) {
    const texts = notes
      .map((n) => {
        if (!n || typeof n !== 'object') return '';
        return String((n as Record<string, unknown>).note ?? '').trim();
      })
      .filter(Boolean);
    if (texts.length) return texts.join('\n');
  }
  const items = item.preauthItems ?? item.preauth_items;
  if (Array.isArray(items)) {
    const texts = items
      .map((n) => {
        if (!n || typeof n !== 'object') return '';
        const row = n as Record<string, unknown>;
        return String(row.responseNote ?? row.response_note ?? '').trim();
      })
      .filter(Boolean);
    if (texts.length) return texts.join('\n');
  }
  return '';
}

function firstDoctorProfile(item: Record<string, unknown>): Record<string, unknown> | null {
  const doctors = item.preauthDoctors ?? item.preauth_doctors;
  if (!Array.isArray(doctors) || doctors.length === 0) return null;
  const first = doctors[0] as Record<string, unknown>;
  const profile = (first.doctorProfile ?? first.doctor_profile ?? first) as Record<string, unknown>;
  return profile && typeof profile === 'object' ? profile : null;
}

export function normalizePreauthPreviewItem(item: Record<string, unknown>, consentToken: string): PreauthPreviewRow {
  const interventionData = (item.interventionData ?? item.intervention_data ?? {}) as Record<string, unknown>;
  const profile = firstDoctorProfile(item);
  const interventionCode = String(
    item.interventionCode ?? item.intervention_code ?? interventionData.code ?? '',
  ).trim();
  const interventionName = String(interventionData.name ?? item.interventionName ?? interventionCode).trim();
  const status = String(item.status ?? item.preauth_status ?? '').toUpperCase();
  const preauthType = String(
    item.preauthType ??
    item.preauth_type ??
    (item.isOncology || item.is_oncology
      ? 'ONCOLOGY'
      : item.isSurgical || item.is_surgical
        ? 'SURGICAL'
        : item.isRenal || item.is_renal
          ? 'RENAL'
          : item.isRadiology || item.is_radiology
            ? 'RADIOLOGY'
            : item.isOptical || item.is_optical
              ? 'OPTICAL'
              : 'NORMAL'),
  ).toUpperCase();
  const id = String(item.guid ?? item.id ?? `${consentToken}-${interventionCode}-${status}`);
  const practitionerRegistrationNumber = String(
    profile?.practitionerRegistrationNumber ??
    profile?.practitioner_registration_number ??
    profile?.nationalIdentifier ??
    '',
  ).trim();

  return {
    id,
    consentToken,
    status,
    preauthType,
    interventionCode,
    interventionName,
    memberName: String(item.memberName ?? item.member_name ?? '').trim(),
    memberIdentifier: String(item.memberIdentifier ?? item.member_identifier ?? '').trim(),
    preauthToken: String(item.token ?? item.preauth_code ?? item.preauthCode ?? '').trim(),
    doctorName: String(profile?.name ?? '').trim(),
    practitionerRegistrationNumber,
    needsDoctorApproval: item.needsDoctorApproval === true || item.needs_doctor_approval === true,
    doctorApproved: item.doctorApproved === true || item.doctor_approved === true,
    serviceStart: String(item.serviceStart ?? item.service_start ?? '').trim(),
    notes: extractPreauthNotesFromItem(item),
    raw: item,
  };
}

export async function resendPreauthDoctorConsent(params: {
  practitionerRegistrationNumber: string;
  consentToken: string;
  interventionCode: string;
  locationUuid: string;
}) {
  const { hieBaseUrl } = await getHieBaseUrl();
  const url = `${hieBaseUrl}/pre-auth/doctor-consent`;
  const body = {
    practitioner_registration_number: params.practitionerRegistrationNumber,
    request_type: 'PREAUTH_DOCTOR_APPROVAL_REQUEST' as const,
    consent_token: params.consentToken,
    intervention_code: params.interventionCode,
    locationUuid: params.locationUuid,
  };
  try {
    const result = await openmrsFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return result?.data;
  } catch (error: any) {
    const message = error?.responseBody?.message ?? error?.message ?? 'Failed to resend doctor consent';
    if (typeof message === 'object') {
      throw `${(message as string[])?.join?.(',') ?? JSON.stringify(message)}`;
    }
    throw message;
  }
}

/**
 * Cancel an existing HIE preauth (POST /api/v1/preauths/cancel via hie-saf).
 * @see https://hie-docs.dha.go.ke/docs/claims/process/preauths/cancelPreauth
 */
export async function cancelPreauth(params: {
  consentToken: string;
  interventionCode: string;
  locationUuid: string;
}) {
  const consentToken = String(params.consentToken ?? '').trim();
  const interventionCode = String(params.interventionCode ?? '').trim();
  const locationUuid = String(params.locationUuid ?? '').trim();
  if (!consentToken || !interventionCode || !locationUuid) {
    throw new Error('Missing consent token, intervention code, or location to cancel preauth');
  }

  const { hieBaseUrl } = await getHieBaseUrl();
  const url = `${hieBaseUrl}/pre-auth/request/cancel`;
  try {
    const result = await openmrsFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consentToken,
        interventionCode,
        locationUuid,
      }),
    });
    return result?.data;
  } catch (error: any) {
    throw extractHieErrorMessage(error, 'Failed to cancel preauth');
  }
}

/**
 * Load all preauth preview rows for a set of claim-visit consent tokens.
 * Tokens without a preauth (404 / empty) are skipped.
 */
export async function fetchPreauthPreviewRowsForTokens(
  consentTokens: string[],
  locationUuid: string,
  { force = false }: { force?: boolean } = {},
): Promise<PreauthPreviewRow[]> {
  const unique = [...new Set(consentTokens.map((t) => t.trim()).filter(Boolean))];
  const rows: PreauthPreviewRow[] = [];

  const CONCURRENCY = 4;
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const chunk = unique.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(
      chunk.map(async (token) => {
        try {
          const preview = await getPreauthPreview(token, locationUuid, { force });
          return unwrapPreauthPreviewItems(preview).map((item) => normalizePreauthPreviewItem(item, token));
        } catch {
          return [] as PreauthPreviewRow[];
        }
      }),
    );
    for (const batch of settled) {
      rows.push(...batch);
    }
  }

  return rows;
}

const PREAUTH_TERMINAL_FAILURE = new Set([
  'REJECTED',
  'CANCELLED',
  'CANCELED',
  'FAILED',
  'DECLINED',
  // Expired approvals cannot be reused — provider raises a fresh preauth.
  'EXPIRED',
]);

const PREAUTH_SUBMITTED = new Set(['ACTIVE', 'PENDING_DOCTOR_APPROVAL', 'FINALISED', 'FINALIZED']);

function interventionCodeFromPreviewItem(item: Record<string, unknown>): string {
  const interventionData = (item.interventionData ?? item.intervention_data ?? {}) as Record<string, unknown>;
  return String(item.interventionCode ?? item.intervention_code ?? interventionData.code ?? '').trim();
}

function statusFromPreviewItem(item: Record<string, unknown>): string {
  const auth = item.authorizationDetails as Record<string, unknown> | undefined;
  // Prefer the row's own status — overallPreauthFinalised is visit-wide and misleading
  // when matching a single intervention.
  const status = String(item.status ?? item.preauth_status ?? '').toUpperCase();
  const doctorReview = String(item.doctorReviewStatus ?? item.doctor_review_status ?? '').toUpperCase();

  if (doctorReview && PREAUTH_TERMINAL_FAILURE.has(doctorReview) && status !== 'FINALISED' && status !== 'FINALIZED') {
    return doctorReview;
  }

  if (!status && (auth?.overallPreauthFinalised === true || auth?.overall_preauth_finalised === true)) {
    return 'FINALISED';
  }

  return status;
}

/** Find the preview row for a specific intervention code (paginated `results[]`). */
export function findPreauthPreviewForIntervention(
  preview: unknown,
  interventionCode: string,
): Record<string, unknown> | null {
  const code = (interventionCode ?? '').trim();
  if (!code) return null;
  const items = unwrapPreauthPreviewItems(preview);
  const direct = items.find((item) => interventionCodeFromPreviewItem(item) === code) ?? null;
  if (direct) return direct;

  // Some payloads only stamp the code on nested preauthItems[].
  return (
    items.find((item) => {
      const nested = item.preauthItems ?? item.preauth_items;
      if (!Array.isArray(nested)) return false;
      return nested.some((n) => {
        if (!n || typeof n !== 'object') return false;
        const row = n as Record<string, unknown>;
        return String(row.interventionCode ?? row.intervention_code ?? '').trim() === code;
      });
    }) ?? null
  );
}

export function extractPreauthStatusForIntervention(preview: unknown, interventionCode: string): string {
  const item = findPreauthPreviewForIntervention(preview, interventionCode);
  if (!item) return '';
  return statusFromPreviewItem(item);
}

export function extractPreauthCodeForIntervention(preview: unknown, interventionCode: string): string | undefined {
  const item = findPreauthPreviewForIntervention(preview, interventionCode);
  if (!item) return undefined;
  return extractPreauthCode(item);
}

/**
 * True when preview already has a non-failed, non-clarification preauth for this
 * intervention — Raise should be hidden. Terminal failure and clarification allow
 * reopening the form to resubmit.
 */
export function interventionHasBlockingPreauth(preview: unknown, interventionCode: string): boolean {
  const item = findPreauthPreviewForIntervention(preview, interventionCode);
  if (!item) return false;
  const status = statusFromPreviewItem(item);
  if (!status) return true; // row exists but status blank — treat as already raised
  return !isPreauthResubmittable(status);
}

/**
 * True when this intervention's preauth failed or needs clarification —
 * UI can offer Resubmit and reopen the preauth form.
 */
export function interventionHasFailedPreauth(preview: unknown, interventionCode: string): boolean {
  const status = extractPreauthStatusForIntervention(preview, interventionCode);
  return Boolean(status) && isPreauthResubmittable(status);
}

/** Alias for clarity at call sites that mean "resubmit", not only hard failure. */
export function interventionAllowsPreauthResubmit(preview: unknown, interventionCode: string): boolean {
  return interventionHasFailedPreauth(preview, interventionCode);
}

export type ExistingPreauthMatch = {
  status: string;
  preauthCode?: string;
  consentToken?: string;
  source: 'hie_preview' | 'local_hold';
  /** True when Raise/create should be blocked (active / pending / finalised). */
  blocking: boolean;
  /** Beneficiary CR from the matched authorization / preview, when known. */
  beneficiaryCode?: string;
};

/** Normalize CR / beneficiary codes for equality (trim + upper). */
function normalizeBeneficiaryCr(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

/**
 * Pull beneficiary CR from a preauth preview row (authorizationDetails / beneficiaryDetails).
 * Prefers CR-style codes (start with CR) over national ID / memberIdentifier.
 */
export function extractBeneficiaryCrFromPreviewItem(item: Record<string, unknown> | null | undefined): string {
  if (!item) return '';
  const auth = (item.authorizationDetails ?? item.authorization_details ?? {}) as Record<string, unknown>;
  const beneficiary = (item.beneficiaryDetails ?? item.beneficiary_details ?? {}) as Record<string, unknown>;
  const eligibility = (auth.eligibilityDetails ?? auth.eligibility_details ?? {}) as Record<string, unknown>;
  const member = (eligibility.member ?? {}) as Record<string, unknown>;

  const candidates = [
    auth.beneficiaryCode,
    auth.beneficiary_code,
    beneficiary.beneficiaryCode,
    beneficiary.beneficiary_code,
    member.beneficiaryCode,
    member.beneficiary_code,
  ];

  for (const c of candidates) {
    const v = String(c ?? '').trim();
    if (v) return v;
  }

  // authCode is often `{CR}-{token}` e.g. CR1900367291321-5-2BEGP65AXH
  const authCode = String(auth.authCode ?? auth.auth_code ?? '').trim();
  if (/^CR/i.test(authCode)) {
    const parts = authCode.split('-');
    if (parts.length >= 3) {
      const last = parts[parts.length - 1] ?? '';
      // Drop trailing authorization token segment when present
      if (/^[A-Z0-9]{6,}$/i.test(last)) {
        return parts.slice(0, -1).join('-');
      }
    }
    return authCode;
  }

  return '';
}

function previewBeneficiaryMatchesCr(
  preview: unknown,
  interventionCode: string,
  beneficiaryCr: string,
): boolean {
  const expected = normalizeBeneficiaryCr(beneficiaryCr);
  if (!expected) return true; // no CR to enforce
  const item = findPreauthPreviewForIntervention(preview, interventionCode);
  if (!item) return false;
  const found = normalizeBeneficiaryCr(extractBeneficiaryCrFromPreviewItem(item));
  // If HIE omitted beneficiary fields, do not treat as a match for another patient —
  // require an explicit CR when we were given one to enforce.
  if (!found) return false;
  return found === expected;
}

function authorizationMatchesBeneficiaryCr(auth: { beneficiaryCode?: string }, beneficiaryCr: string): boolean {
  const expected = normalizeBeneficiaryCr(beneficiaryCr);
  if (!expected) return true;
  const found = normalizeBeneficiaryCr(auth?.beneficiaryCode);
  // Keep tokens missing beneficiaryCode; preview CR check is the hard gate.
  if (!found) return true;
  return found === expected;
}

function matchFromPreview(
  preview: unknown,
  interventionCode: string,
  consentToken: string,
  source: ExistingPreauthMatch['source'] = 'hie_preview',
  beneficiaryCr?: string | null,
): ExistingPreauthMatch | null {
  const item = findPreauthPreviewForIntervention(preview, interventionCode);
  if (!item) return null;
  if (beneficiaryCr && !previewBeneficiaryMatchesCr(preview, interventionCode, beneficiaryCr)) {
    return null;
  }
  const status = extractPreauthStatusForIntervention(preview, interventionCode) || '';
  const preauthCode = extractPreauthCodeForIntervention(preview, interventionCode);
  const blocking = interventionHasBlockingPreauth(preview, interventionCode);
  const beneficiaryCode = extractBeneficiaryCrFromPreviewItem(item) || undefined;
  return {
    status: status || 'UNKNOWN',
    preauthCode,
    consentToken,
    source,
    blocking,
    beneficiaryCode,
  };
}

/** TEMP — set false to restore Raise/Submit duplicate preauth blocking. */
const DISABLE_DUPLICATE_PREAUTH_CHECK = true;

/**
 * Look up an existing HIE (or local hold) preauth for the same beneficiary CR + SHA intervention code.
 * Used before Raise/Submit to avoid duplicate active preauths.
 *
 * Preview / authorization beneficiaryCode must match `beneficiaryCr` when provided —
 * SHA intervention code alone is not enough (tokens can resolve rows for another member).
 */
export async function findExistingPreauthForCrAndShaCode(opts: {
  beneficiaryCr: string;
  interventionCode: string;
  locationUuid: string;
  consentToken?: string | null;
  patientUuid?: string | null;
}): Promise<ExistingPreauthMatch | null> {
  if (DISABLE_DUPLICATE_PREAUTH_CHECK) {
    return null;
  }

  const cr = String(opts.beneficiaryCr ?? '').trim();
  const code = String(opts.interventionCode ?? '').trim();
  const loc = String(opts.locationUuid ?? '').trim();
  if (!code || !loc) return null;

  const preferToken = String(opts.consentToken ?? '').trim();
  if (preferToken) {
    try {
      const preview = await getPreauthPreview(preferToken, loc);
      const match = matchFromPreview(preview, code, preferToken, 'hie_preview', cr || null);
      if (match?.blocking) return match;
    } catch {
      // continue CR-wide scan
    }
  }

  if (cr) {
    try {
      const auths = await getAuthorizations(loc, cr, undefined);
      const tokens = [
        ...new Set(
          (auths ?? [])
            .filter((a) => authorizationMatchesBeneficiaryCr(a, cr))
            .map((a) => String(a?.token ?? '').trim())
            .filter((t) => t && t !== preferToken),
        ),
      ];
      // Cap concurrency to avoid hammering HIE
      const CONCURRENCY = 4;
      let resubmittable: ExistingPreauthMatch | null = null;
      for (let i = 0; i < tokens.length; i += CONCURRENCY) {
        const chunk = tokens.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          chunk.map(async (token) => {
            try {
              const preview = await getPreauthPreview(token, loc);
              return matchFromPreview(preview, code, token, 'hie_preview', cr);
            } catch {
              return null;
            }
          }),
        );
        for (const match of results) {
          if (!match) continue;
          if (match.blocking) return match;
          if (!resubmittable) resubmittable = match;
        }
      }
      if (resubmittable) return resubmittable;
    } catch {
      // fall through to local holds
    }
  }

  const patientUuid = String(opts.patientUuid ?? '').trim();
  if (patientUuid) {
    try {
      const holds = await listPreAuthRequests({
        locationUuid: loc,
        patientUuid,
        interventionCode: code,
      });
      const withToken = holds.filter((h) => String(h.consentToken ?? '').trim());
      for (const hold of withToken) {
        const token = String(hold.consentToken).trim();
        try {
          const preview = await getPreauthPreview(token, String(hold.locationUuid || loc).trim() || loc);
          const match = matchFromPreview(preview, code, token, 'local_hold', cr || null);
          if (match?.blocking) return match;
        } catch {
          // No preview — only block from local hold when we have a patientUuid-scoped row.
          const status = String(hold.status ?? '').trim().toUpperCase();
          if (status && !isPreauthResubmittable(status)) {
            return {
              status,
              consentToken: token,
              source: 'local_hold',
              blocking: true,
            };
          }
        }
      }
      // Hold without token but already marked raised/active locally
      const raisedHold = holds.find((h) => {
        const status = String(h.status ?? '').trim().toUpperCase();
        return (
          status &&
          !isPreauthResubmittable(status) &&
          status !== 'DRAFT' &&
          !String(h.consentToken ?? '').trim()
        );
      });
      if (raisedHold) {
        return {
          status: String(raisedHold.status).trim().toUpperCase(),
          source: 'local_hold',
          blocking: true,
        };
      }
    } catch {
      // ignore local hold lookup failures
    }
  }

  // Re-check preferred token for non-blocking (resubmittable) match
  if (preferToken) {
    try {
      const preview = await getPreauthPreview(preferToken, loc);
      return matchFromPreview(preview, code, preferToken, 'hie_preview', cr || null);
    } catch {
      return null;
    }
  }

  return null;
}

export function extractPreauthStatus(preview: unknown): string {
  const item = unwrapPreauthPreviewItem(preview);
  if (!item) {
    return '';
  }

  const auth = item.authorizationDetails as Record<string, unknown> | undefined;
  if (auth?.overallPreauthFinalised === true || auth?.overall_preauth_finalised === true) {
    return 'FINALISED';
  }

  return statusFromPreviewItem(item);
}

export function extractPreauthCode(preview: unknown): string | undefined {
  const item = unwrapPreauthPreviewItem(preview);
  if (!item) {
    return undefined;
  }
  const auth = item.authorizationDetails as Record<string, unknown> | undefined;
  const fromAuth = (auth?.authCode as string) || (auth?.auth_code as string) || (auth?.token as string) || undefined;

  return (
    (item.preauth_code as string) ||
    (item.preauthCode as string) ||
    (item.token as string) ||
    fromAuth ||
    (item.authCode as string) ||
    (item.id != null ? String(item.id) : undefined) ||
    (item.preauth_id != null ? String(item.preauth_id) : undefined)
  );
}

export function isPreauthFinalised(status: string): boolean {
  const s = (status || '').toUpperCase();
  return s === 'FINALISED' || s === 'FINALIZED';
}

export function isPreauthTerminalFailure(status: string): boolean {
  const s = (status || '').toUpperCase();
  if (PREAUTH_TERMINAL_FAILURE.has(s)) return true;
  // HIE sometimes returns prefixed / alternate spellings (e.g. PREAUTH_CANCELLED).
  if (s.includes('CANCEL')) return true;
  if (s.includes('EXPIRED')) return true;
  return false;
}

/** Failure, cancellation, expiry, or clarification — provider may reopen and raise again. */
export function isPreauthResubmittable(status: string): boolean {
  return isPreauthTerminalFailure(status) || isPreauthNeedsClarification(status);
}

/** Statuses that mean the preauth was accepted by HIE — form can close. */
export function isPreauthSubmitted(status: string): boolean {
  return PREAUTH_SUBMITTED.has((status || '').toUpperCase());
}

export type PreauthCheckKind = 'not_raised' | 'finalised' | 'pending' | 'failed' | 'error';

export type PreauthCheckResult = {
  status: string;
  preauthCode?: string;
  preview: unknown;
  kind: PreauthCheckKind;
  notes?: string;
  error?: string;
};

/**
 * Read one intervention's preauth status out of a preview already in hand.
 *
 * Split out of `checkPreauthStatus` so a list can fetch a visit's preview once and read
 * every one of that visit's interventions off it. The Needs-raise queue used to call
 * `checkPreauthStatus` per bill row, and a visit's rows all share its consent token — so a
 * patient with five interventions cost five identical calls to the same HIE endpoint.
 */
export function readPreauthCheck(preview: unknown, interventionCode?: string | null): PreauthCheckResult {
  const code = (interventionCode ?? '').trim();
  const item = code ? findPreauthPreviewForIntervention(preview, code) : unwrapPreauthPreviewItem(preview);
  // Paginated empty results / null body → not raised
  if (!preview || !item) {
    return { status: '', preview, kind: 'not_raised' };
  }

  const status = code ? extractPreauthStatusForIntervention(preview, code) : extractPreauthStatus(preview);
  const preauthCode = code ? extractPreauthCodeForIntervention(preview, code) : extractPreauthCode(preview);
  const notes = extractPreauthNotesFromItem(item);

  if (!status) {
    // Row exists for this intervention but status blank — treat as already raised.
    return { status: '', preview, kind: 'pending', preauthCode, notes };
  }
  if (isPreauthFinalised(status)) {
    return { status: 'FINALISED', preview, kind: 'finalised', preauthCode, notes };
  }
  if (isPreauthTerminalFailure(status)) {
    return { status, preview, kind: 'failed', preauthCode, notes };
  }
  // Clarification stays `pending` for status-tag colouring ("Needs clarification"),
  // but is not a blocking preauth — callers use isPreauthNeedsClarification / resubmit helpers.
  return { status, preview, kind: 'pending', preauthCode, notes };
}

/** One-shot preauth status check for lists, gates, and non-React callers. */
export async function checkPreauthStatus(
  consentToken: string | null | undefined,
  locationUuid: string | null | undefined,
  interventionCode?: string | null,
): Promise<PreauthCheckResult> {
  if (!consentToken?.trim()) {
    return {
      status: '',
      preview: null,
      kind: 'error',
      error: 'Missing consent token',
    };
  }
  if (!locationUuid?.trim()) {
    return {
      status: '',
      preview: null,
      kind: 'error',
      error: 'Missing location',
    };
  }

  try {
    const preview = await getPreauthPreview(consentToken.trim(), locationUuid.trim());
    return readPreauthCheck(preview, interventionCode);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e ?? 'Failed to get preauth preview');
    return {
      status: '',
      preview: null,
      kind: 'error',
      error: message,
    };
  }
}

export const preauthPreviewSwrKey = (consentToken: string, locationUuid: string) =>
  ['preauth-preview', consentToken, locationUuid] as const;

/** SWR hook for reusable preauth status elsewhere in the app. */
export function usePreauthPreview(consentToken: string | null | undefined, locationUuid: string | null | undefined) {
  const key =
    consentToken?.trim() && locationUuid?.trim()
      ? preauthPreviewSwrKey(consentToken.trim(), locationUuid.trim())
      : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    key,
    ([, token, loc]) => checkPreauthStatus(token, loc),
    {
      keepPreviousData: true,
      // Every automatic trigger is off, as on `useProviderClaimPreview`. This preview is a
      // round trip to the HIE, several components read the same claim's copy of it, and
      // the HIE rate-limits — so it is fetched when something asks: the first read of a
      // claim, or a mutation that invalidates it (see `invalidatePreauthPreview`). Left on,
      // `revalidateOnFocus` alone refetched every mounted claim each time the window was
      // clicked back into, and `revalidateIfStale` refetched on every remount.
      //
      // `revalidateOnMount` is deliberately left unset so SWR still fetches when there is
      // no cached preview yet, and skips it when there is.
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
    },
  );

  return {
    preview: data?.preview ?? null,
    status: data?.status ?? '',
    preauthCode: data?.preauthCode,
    kind: data?.kind,
    check: data,
    error: error ?? (data?.kind === 'error' ? data.error : undefined),
    isLoading,
    isValidating,
    mutate,
  };
}

export async function invalidatePreauthPreview(consentToken: string, locationUuid: string) {
  if (!consentToken?.trim() || !locationUuid?.trim()) return;
  // Both caches in front of the endpoint, in this order: the burst cache first, so the
  // revalidation SWR is about to run actually reaches the HIE rather than being answered
  // out of it.
  forgetPreauthPreview(consentToken.trim(), locationUuid.trim());
  await globalMutate(preauthPreviewSwrKey(consentToken.trim(), locationUuid.trim()));
}

/** Poll GET /pre-auth/preview until FINALISED or a terminal failure. */
export async function pollPreauthUntilFinalised(
  consentToken: string,
  locationUuid: string,
  {
    intervalMs = 3000,
    maxAttempts = 40,
    signal,
  }: { intervalMs?: number; maxAttempts?: number; signal?: AbortSignal } = {},
): Promise<{ status: string; preview: unknown; preauthCode?: string }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new Error('Preauth poll cancelled');
    }
    // A poll exists to see a change, so it asks past the burst cache every time.
    const preview = await getPreauthPreview(consentToken, locationUuid, { force: true });
    const status = extractPreauthStatus(preview);
    if (isPreauthFinalised(status)) {
      return { status: 'FINALISED', preview, preauthCode: extractPreauthCode(preview) };
    }
    if (status && isPreauthTerminalFailure(status)) {
      throw new Error(`Preauth ${status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Timed out waiting for preauth to reach FINALISED');
}

/**
 * Poll until the matching intervention's preauth is ACTIVE, PENDING_DOCTOR_APPROVAL,
 * or FINALISED — enough to close the Raise form without waiting on payer finalisation.
 */
export async function pollPreauthUntilSubmitted(
  consentToken: string,
  locationUuid: string,
  interventionCode: string,
  {
    intervalMs = 3000,
    maxAttempts = 40,
    signal,
  }: { intervalMs?: number; maxAttempts?: number; signal?: AbortSignal } = {},
): Promise<{ status: string; preview: unknown; preauthCode?: string }> {
  const code = (interventionCode ?? '').trim();
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new Error('Preauth poll cancelled');
    }
    const preview = await getPreauthPreview(consentToken, locationUuid, { force: true });
    const status = code ? extractPreauthStatusForIntervention(preview, code) : extractPreauthStatus(preview);
    if (status && isPreauthSubmitted(status)) {
      return {
        status: isPreauthFinalised(status) ? 'FINALISED' : status,
        preview,
        preauthCode: code ? extractPreauthCodeForIntervention(preview, code) : extractPreauthCode(preview),
      };
    }
    if (status && isPreauthTerminalFailure(status)) {
      throw new Error(`Preauth ${status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Timed out waiting for preauth submission confirmation');
}

export const getServiceType = (selectedIntervention: Intervention, visitType?: VisitType): ServiceType => {
  const paymentMechanism = selectedIntervention.paymentMechanism;
  const accessPoint = selectedIntervention.accessPoint;

  if (paymentMechanism.trim().toUpperCase() === 'CAPITATION') {
    return 'CAPITATION';
  }
  if (['PER DIEM', 'PER_DIEM'].includes(paymentMechanism.trim().toUpperCase())) {
    return 'INPATIENT';
  }
  if (accessPoint.trim().toUpperCase() === 'IP') {
    return 'INPATIENT';
  }
  if (accessPoint.trim().toUpperCase() === 'OP') {
    return 'OUTPATIENT';
  }
  if (accessPoint.trim().toUpperCase() === 'OP AND IP') {
    return visitType;
  }
  return visitType;
};

export const createPreauthRequest = async (preauthRequest: PreauthRequest) => {
  const hieBaseUrl = await getHieBaseUrl();
  const postUrl = `${hieBaseUrl}/pre-auth/request`;
  return openmrsFetch<{}>(postUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: preauthRequest,
  });
};

export type ListPreAuthRequestsParams = {
  locationUuid?: string;
  patientUuid?: string;
  electivePreauth?: boolean;
  status?: string;
  encounterUuid?: string;
  interventionCode?: string;
};

export const listPreAuthRequests = async (
  params: ListPreAuthRequestsParams,
): Promise<import('./index').PreAuthRequestRecord[]> => {
  const { hieBaseUrl } = await getHieBaseUrl();
  const qs = new URLSearchParams();
  if (params.locationUuid) qs.set('locationUuid', params.locationUuid);
  if (params.patientUuid) qs.set('patientUuid', params.patientUuid);
  if (params.status) qs.set('status', params.status);
  if (params.encounterUuid) qs.set('encounterUuid', params.encounterUuid);
  if (params.interventionCode) qs.set('interventionCode', params.interventionCode);
  if (params.electivePreauth !== undefined) {
    qs.set('electivePreauth', String(params.electivePreauth));
  }
  const url = `${hieBaseUrl}/pre-auth/request?${qs.toString()}`;
  const response = await openmrsFetch(url);
  const data = response?.data;
  const rows = Array.isArray(data) ? data : [];
  return rows.map(normalizePreAuthRequestRecord);
};

/** Normalize hie-saf pre-auth rows (camelCase or snake_case) for the UI. */
function normalizePreAuthRequestRecord(raw: unknown): import('./index').PreAuthRequestRecord {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (a: unknown, b?: unknown) => String(a ?? b ?? '').trim();
  const bool = (a: unknown, b?: unknown) => {
    const v = a ?? b;
    if (typeof v === 'boolean') return v;
    if (v == null || v === '') return undefined;
    if (v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true') return true;
    if (v === false || v === 0 || v === '0' || String(v).toLowerCase() === 'false') return false;
    return Boolean(v);
  };
  const idRaw = r.id ?? r.preAuthRequestId ?? r.pre_auth_request_id;
  return {
    id: Number(idRaw) || 0,
    patientUuid: str(r.patientUuid, r.patient_uuid),
    orderNo: str(r.orderNo, r.order_no),
    subBenefitCode: str(r.subBenefitCode, r.sub_benefit_code),
    interventionCode: str(r.interventionCode, r.intervention_code),
    consentToken: str(r.consentToken, r.consent_token) || null,
    encounterUuid: str(r.encounterUuid, r.encounter_uuid) || null,
    expectedServiceStartDate: str(r.expectedServiceStartDate, r.expected_service_start_date) || null,
    serviceType: str(r.serviceType, r.service_type),
    locationUuid: str(r.locationUuid, r.location_uuid),
    billableServiceUuid: str(r.billableServiceUuid, r.billable_service_uuid) || null,
    priceUuid: str(r.priceUuid, r.price_uuid) || null,
    requiresPreauth: bool(r.requiresPreauth, r.requires_preauth),
    normalPreauth: bool(r.normalPreauth, r.normal_preauth),
    electivePreauth: bool(r.electivePreauth, r.elective_preauth),
    applicableDocumentTypes: str(r.applicableDocumentTypes, r.applicable_document_types) || undefined,
    requiredPreauthDocumentTypes:
      str(r.requiredPreauthDocumentTypes, r.required_preauth_document_types) || undefined,
    status: str(r.status) || undefined,
    dateCreated: str(r.dateCreated, r.date_created) || undefined,
  };
}

export const patchPreAuthRequest = async (
  id: number,
  body: { status?: string; consentToken?: string; orderNo?: string },
) => {
  const { hieBaseUrl } = await getHieBaseUrl();
  return openmrsFetch(`${hieBaseUrl}/pre-auth/request/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
};
