import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { getHieBaseUrl } from '../shared/utils/get-base-url';
import { IdentifierTypesUuids } from '../resources/identifier-types';
import {
  ShrApiError,
  type CloseVisitResponse,
  type CreateConsentRequest,
  type CreateConsentResponse,
  type ShrAnyResource,
  type ShrRecordSet,
  type VerifyConsentRequest,
  type VerifyConsentResponse,
} from './shr.types';

/**
 * Shared Health Record (SHR) data source.
 *
 * All four endpoints are relative to the configured HIE base URL —
 * `getHieBaseUrl()`, the same helper the CR search, EMT and claims calls use —
 * and go through `openmrsFetch`, so session auth rides the live OpenMRS cookie.
 * The raw curl examples set a `Cookie` header by hand; we deliberately don't.
 */

const SHR_BASE = '/shr';

/** Envelope keys an SHR payload might hide a resource list under. */
const RESOURCE_LIST_KEYS = ['entry', 'entries', 'resources', 'records', 'results', 'data', 'bundle', 'bundles'];

/**
 * Create a consent request. The backend dispatches an OTP to the patient's
 * registered contact and returns the `consent_id` + `otp_record` pair that the
 * verify call needs.
 */
export async function createConsentRequest(payload: CreateConsentRequest): Promise<CreateConsentResponse> {
  try {
    const hieBaseUrl = await getHieBaseUrl();
    const response = await openmrsFetch<CreateConsentResponse>(`${hieBaseUrl}${SHR_BASE}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    return response?.data;
  } catch (err) {
    throw normalizeError(err);
  }
}

/**
 * Verify the OTP the patient received. On success the response carries the
 * consent token used to fetch records and the `visit_id` needed to close the
 * visit afterwards — `visit_id` has no other source.
 */
export async function verifyConsentOtp(
  consentId: string,
  payload: VerifyConsentRequest,
): Promise<VerifyConsentResponse> {
  try {
    const hieBaseUrl = await getHieBaseUrl();
    const response = await openmrsFetch<VerifyConsentResponse>(
      `${hieBaseUrl}${SHR_BASE}/consents/${encodeURIComponent(consentId)}/verify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      },
    );
    return response?.data;
  } catch (err) {
    throw normalizeError(err);
  }
}

/**
 * Fetch the patient's shared records for the requested resource types.
 *
 * `resources` is built by joining the configured resource types, so adding or
 * removing a viewer category is a config change (see `shrResourceTypes`) rather
 * than a code change. The consent token is passed as `X-Consent-Token`.
 */
export async function fetchPatientRecords({
  crId,
  resourceTypes,
  locationUuid,
  consentToken,
}: {
  crId: string;
  resourceTypes: string[];
  locationUuid: string;
  consentToken: string;
}): Promise<ShrRecordSet> {
  try {
    const hieBaseUrl = await getHieBaseUrl();
    const params = new URLSearchParams({
      crId,
      resources: resourceTypes.join(','),
      locationUuid,
    });
    const response = await openmrsFetch<unknown>(`${hieBaseUrl}${SHR_BASE}/patient-records?${params.toString()}`, {
      method: 'GET',
      headers: { 'X-Consent-Token': consentToken },
    });
    return summariseRecords(response?.data);
  } catch (err) {
    throw normalizeError(err);
  }
}

/**
 * Close the SHR visit opened by a granted consent. `visitId` is the `visit_id`
 * captured from the verify response.
 *
 * The backend answers "Consent closure initiated." — a `status: "success"` here
 * means the close request was accepted, not that closure has finished
 * server-side, so callers should present `end_date` rather than "just now".
 */
export async function closeShrVisit(visitId: string, locationUuid: string): Promise<CloseVisitResponse> {
  try {
    const hieBaseUrl = await getHieBaseUrl();
    const response = await openmrsFetch<CloseVisitResponse>(
      `${hieBaseUrl}${SHR_BASE}/visits/${encodeURIComponent(visitId)}/close`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { locationUuid },
      },
    );
    return response?.data;
  } catch (err) {
    throw normalizeError(err);
  }
}

/**
 * The patient's Client Registry (CR) number, read off their OpenMRS identifiers.
 *
 * Ported from `ampath-esm-hie-registry-manager-app`'s
 * `getPatientCrIdentifier` — this is how `crId` is derived for the consent
 * request, so the clinician never types it. The identifier type defaults to the
 * CR number type this repo already pins in two places
 * (`IdentifierTypesUuids.CLIENT_REGISTRY_NO_UUID` and the
 * `electivePreauth.clientRegistryIdentifierTypeUuid` config), and callers with
 * config in hand should pass the configured value.
 *
 * Returns an empty string when the patient has no CR number — the caller must
 * treat that as "cannot request SHR consent" rather than sending an empty crId.
 */
export async function getPatientCrIdentifier(
  patientUuid: string,
  identifierTypeUuid: string = IdentifierTypesUuids.CLIENT_REGISTRY_NO_UUID,
): Promise<string> {
  if (!patientUuid) {
    return '';
  }
  try {
    const response = await openmrsFetch<{
      results?: Array<{ identifier?: string; identifierType?: { uuid?: string } }>;
    }>(`${restBaseUrl}/patient/${patientUuid}/identifier`, { method: 'GET' });
    const identifiers = response?.data?.results ?? [];
    const match = identifiers.find((id) => id?.identifierType?.uuid === identifierTypeUuid);
    return match?.identifier ?? '';
  } catch (err) {
    throw normalizeError(err);
  }
}

/**
 * Map an upstream failure into a typed `ShrApiError` carrying the HTTP status.
 * `openmrsFetch` throws `OpenmrsFetchError`, which already carries the real
 * `response.status`; a raw network failure has none and becomes status 0.
 *
 * The raw upstream message is kept intact here — the nested-JSON unwrapping in
 * `extractShrErrorDetail` happens only at the point of display.
 */
export function normalizeError(err: any): ShrApiError {
  if (err instanceof ShrApiError) {
    return err;
  }
  const status = typeof err?.response?.status === 'number' ? err.response.status : 0;
  const message: string =
    (typeof err?.responseBody === 'object' && err?.responseBody?.message) ||
    (typeof err?.responseBody === 'string' && err.responseBody) ||
    (typeof err?.message === 'string' && err.message) ||
    'Unexpected error from the SHR service.';
  return new ShrApiError(status, message);
}

/**
 * Unwrap the doubly-encoded upstream error the verify endpoint returns, e.g.
 *
 *   "failed to verify patient consent: {\"status\": \"error\", … \"message\": \"OTP already used.\"}"
 *
 * Never assume it parses: anything unexpected falls back to a generic line.
 * Applied to all four endpoints, since we only have evidence for verify and no
 * reason to assume the others never nest their errors the same way.
 */
export function extractShrErrorDetail(rawMessage: string): string {
  const fallback = 'We could not verify that code. Try again or resend the OTP.';
  try {
    const idx = rawMessage?.indexOf('{') ?? -1;
    if (idx === -1) {
      return rawMessage || fallback;
    }
    const inner = JSON.parse(rawMessage.slice(idx));
    return inner?.message || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Flatten whatever envelope the patient-records response arrives in into a flat
 * list of FHIR resources.
 *
 * The endpoint is new and its exact envelope is unconfirmed, so rather than
 * hardcoding `Bundle.entry[].resource` this walks the plausible shapes — a FHIR
 * bundle, a bundle of per-type searchset bundles, a bare array, a
 * resourceType-keyed map, or a `{ resources: [...] }`-style wrapper — and
 * collects anything that looks like a resource. Bundles and OperationOutcomes
 * are traversed, not counted.
 */
export function flattenShrResources(payload: unknown): ShrAnyResource[] {
  const collected: ShrAnyResource[] = [];
  const seen = new Set<unknown>();

  const walk = (node: unknown, depth: number) => {
    if (!node || depth > 8) {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, depth + 1));
      return;
    }
    if (typeof node !== 'object') {
      return;
    }
    if (seen.has(node)) {
      return;
    }
    seen.add(node);

    const obj = node as Record<string, any>;
    const resourceType = typeof obj.resourceType === 'string' ? obj.resourceType : '';

    if (resourceType && resourceType !== 'Bundle' && resourceType !== 'OperationOutcome') {
      collected.push(obj as ShrAnyResource);
      return;
    }

    // A bundle (or an unlabelled envelope): descend into whichever list it carries.
    if (obj.resource) {
      walk(obj.resource, depth + 1);
    }
    for (const key of RESOURCE_LIST_KEYS) {
      if (obj[key]) {
        walk(obj[key], depth + 1);
      }
    }
    // Last resort: a map keyed by resource type, e.g. { Encounter: [...], Condition: [...] }.
    if (!resourceType) {
      for (const [key, value] of Object.entries(obj)) {
        if (RESOURCE_LIST_KEYS.includes(key) || key === 'resource') {
          continue;
        }
        if (Array.isArray(value) && /^[A-Z][A-Za-z]+$/.test(key)) {
          walk(value, depth + 1);
        }
      }
    }
  };

  walk(payload, 0);
  return collected;
}

/** Flatten a records payload and pull out the few summary facts the viewer's tiles show. */
export function summariseRecords(payload: unknown): ShrRecordSet {
  const resources = flattenShrResources(payload);
  const sources = Array.from(
    new Set(resources.map((r) => r?.meta?.source?.trim()).filter((s): s is string => Boolean(s))),
  );
  const timestamps = resources
    .map((r) => r?.meta?.lastUpdated)
    .filter((v): v is string => Boolean(v))
    .sort();
  return {
    resources,
    lastUpdated: timestamps.length ? timestamps[timestamps.length - 1] : undefined,
    sources,
    raw: payload,
  };
}
