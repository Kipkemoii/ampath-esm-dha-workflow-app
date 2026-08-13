/**
 * Elective (pre-visit) authorization helpers — Scenario 4 Phase 2.
 *
 * Kept separate from normal / day-of visit consent in `registry/hie.resource.ts`
 * so elective Raise changes do not alter triage / claim-visit OTP flows.
 *
 * @see https://hie-docs.dha.go.ke/docs/scenarios/scenario-4-shif-op-ffs-elective-preauth
 */
import { openmrsFetch } from '@openmrs/esm-framework';
import { getHieBaseUrl } from '../../../../../shared/utils/get-base-url';
import {
  createPreauth,
  extractHieErrorMessage,
  type PreauthFormPayload,
} from '../../../../../claims/claims.resource';
import type { Intervention } from '../../../../../claims/index';
import type { PatientContactResponse, PatientContactResult } from '../../../../../registry/hie.types';
import { getAuthorizations } from '../../../../../registry/hie.resource';
import type { Authorization } from '../../../../../registry/hie.types';

export type ElectiveAuthorizationResult = {
  token?: string;
  guid?: string;
  status?: string;
  [key: string]: unknown;
};

const PREVISIT_REUSABLE = new Set(['AUTHORIZED_PENDING_VISIT']);

function unwrapAuthorizeError(data: any, status: number): string {
  const raw = data?.message || data?.error || data?.details || 'Failed to authorize elective preauth';
  let errorText =
    typeof raw === 'string'
      ? raw
      : Array.isArray(raw)
        ? raw.join('; ')
        : `Request failed with ${status}`;
  try {
    const nested = JSON.parse(errorText);
    if (nested?.error) {
      errorText = Array.isArray(nested.error) ? nested.error.join('; ') : String(nested.error);
    } else if (typeof nested === 'string') {
      errorText = nested;
    }
  } catch {
    const m = errorText.match(/could not create the authorization:\s*(\{[\s\S]*\})\s*$/i);
    if (m?.[1]) {
      try {
        const inner = JSON.parse(m[1]);
        if (Array.isArray(inner?.error)) errorText = inner.error.join('; ');
      } catch {
        /* keep */
      }
    }
  }
  return errorText;
}

/** Phase 2 step 6a — GET /api/v1/patients/contacts (via hie-saf). */
export async function fetchElectivePatientContacts(
  patientId: string,
  locationUuid: string,
): Promise<PatientContactResult[]> {
  const hieBaseUrl = await getHieBaseUrl();
  const url = `${hieBaseUrl}/client/contacts`;
  const response = await openmrsFetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ crId: patientId, locationUuid }),
  });

  const data =
    typeof (response as any)?.json === 'function'
      ? await (response as any).json()
      : ((response as any)?.data ?? response);

  if (!(response as any).ok && (response as any).status >= 400) {
    throw new Error(data?.message || 'Failed to fetch patient contacts');
  }

  const typed = data as PatientContactResponse | PatientContactResult[];
  const rows = Array.isArray((typed as PatientContactResponse)?.results)
    ? (typed as PatientContactResponse).results
    : Array.isArray(typed)
      ? typed
      : [];
  return rows.filter((c) => c && c.active !== false);
}

/**
 * Phase 2 step 7a — POST /api/v1/claims/otp.
 * Optional beneficiary_contact_id after contact confirmation.
 */
export async function sendElectivePreauthOtp(params: {
  patientId: string;
  locationUuid: string;
  interventionCode: string;
  beneficiaryContactId?: string;
}): Promise<unknown> {
  const patientId = String(params.patientId ?? '').trim();
  const locationUuid = String(params.locationUuid ?? '').trim();
  const interventionCode = String(params.interventionCode ?? '').trim();
  if (!patientId || !locationUuid || !interventionCode) {
    throw new Error('Missing patient, location, or intervention for elective OTP');
  }

  // Intentionally does not call cancelAllPendingAuthorizations — Raise/elective OTP
  // must not wipe in-flight claim authorizations for this beneficiary.

  const hieBaseUrl = await getHieBaseUrl();
  const body: Record<string, unknown> = {
    intervention_codes: [interventionCode],
    patient_id: patientId,
    locationUuid,
  };
  const contactId = String(params.beneficiaryContactId ?? '').trim();
  if (contactId) {
    body.beneficiary_contact_id = contactId;
  }

  const response = await openmrsFetch(`${hieBaseUrl}/claims-otp`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data =
    typeof (response as any)?.json === 'function'
      ? await (response as any).json()
      : ((response as any)?.data ?? response);

  if (!(response as any).ok && (response as any).status >= 400) {
    throw new Error(data?.message || `Failed to send elective OTP (${(response as any).status})`);
  }

  return data;
}

/**
 * Phase 2 step 8a — POST /api/v1/claims/authorize (pre-visit).
 *
 * Body: patient_id, otp, interventions, service_type (+ optional contact).
 * Do NOT send is_elective — HIE treats that as day-of visit needing FINALISED preauth.
 * Expect AUTHORIZED_PENDING_VISIT; use `token` as consent_token for POST /preauths.
 */
export async function authorizeElectivePreauthWithOtp(params: {
  patientId: string;
  otp: string;
  interventions: string[];
  serviceType: string;
  locationUuid: string;
  beneficiaryContactId?: string;
}): Promise<ElectiveAuthorizationResult> {
  const hieBaseUrl = await getHieBaseUrl();
  const body: Record<string, unknown> = {
    patient_id: params.patientId,
    otp: params.otp,
    interventions: params.interventions,
    service_type: params.serviceType,
    locationUuid: params.locationUuid,
  };
  const contactId = String(params.beneficiaryContactId ?? '').trim();
  if (contactId) {
    body.beneficiary_contact_id = contactId;
  }

  const response = await openmrsFetch(`${hieBaseUrl}/claims-authorize`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data =
    typeof (response as any)?.json === 'function'
      ? await (response as any).json()
      : ((response as any)?.data ?? response);

  if (!(response as any).ok && (response as any).status >= 400) {
    throw new Error(unwrapAuthorizeError(data, (response as any).status ?? 400));
  }

  const nested = data?.data && typeof data.data === 'object' ? data.data : data;
  return (nested ?? {}) as ElectiveAuthorizationResult;
}

/**
 * Prefer an existing open AUTHORIZED_PENDING_VISIT for this CR.
 *
 * Calling /claims/authorize again while such a token exists makes HIE treat the
 * request as a day-of "elective visit" and fail with
 * "no active approved preauth … for elective visit with consent token …".
 */
export async function findReusableElectivePreVisitAuthorization(
  patientId: string,
  locationUuid: string,
): Promise<Authorization | null> {
  const cr = String(patientId ?? '').trim();
  const loc = String(locationUuid ?? '').trim();
  if (!cr || !loc) return null;

  try {
    const auths = await getAuthorizations(loc, cr, undefined);
    const reusable = (auths ?? []).filter((a) => {
      const status = String(a?.status ?? '').trim().toUpperCase();
      const token = String(a?.token ?? '').trim();
      if (!token || !PREVISIT_REUSABLE.has(status)) return false;
      if (a.isOpen === false) return false;
      return true;
    });
    return reusable[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve pre-visit consent for elective Raise:
 * 1) reuse AUTHORIZED_PENDING_VISIT if already open for this beneficiary
 * 2) otherwise mint a new one via OTP authorize (Phase 2 step 8a)
 */
export async function resolveOrCreateElectivePreVisitAuthorization(params: {
  patientId: string;
  otp: string;
  interventions: string[];
  serviceType: string;
  locationUuid: string;
  beneficiaryContactId?: string;
}): Promise<ElectiveAuthorizationResult> {
  const existing = await findReusableElectivePreVisitAuthorization(
    params.patientId,
    params.locationUuid,
  );
  if (existing?.token) {
    return {
      token: existing.token,
      status: existing.status,
      guid: existing.guid,
      reused: true,
    };
  }

  return authorizeElectivePreauthWithOtp(params);
}

export function extractElectiveAuthorizationToken(auth: ElectiveAuthorizationResult | null | undefined): string {
  if (!auth) return '';
  return String(
    auth.token ?? (auth as any).consent_token ?? (auth as any).consentToken ?? '',
  ).trim();
}

/**
 * Create elective preauth via the same HIE multipart gateway as normal
 * (`POST /pre-auth/normal` → HIE `/preauths`), but only called from elective Raise.
 * Isolated so we can diverge payload / polling later without touching normal Raise.
 */
export async function createElectivePreauth(
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
  try {
    return await createPreauth(payload, intervention, consentToken);
  } catch (e) {
    throw extractHieErrorMessage(e, 'Failed to create elective preauth');
  }
}
