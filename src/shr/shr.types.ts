/**
 * Types for the national Shared Health Record (SHR) consent workflow and record viewer.
 *
 * Two groups live here:
 *
 *  1. The four `/shr/*` endpoint contracts (§ create consent, verify OTP, fetch
 *     records, close visit). Field names and casing mirror the real backend
 *     exactly — camelCase on the way in, DHA's snake_case on the way back.
 *  2. The FHIR shapes the SHR actually returns. These are ported from
 *     `ampath-esm-hie-registry-manager-app`'s `src/hie/shr/shr-details/types`,
 *     where they were confirmed against this same HIE/SHR backend, and widened
 *     with a few optional fields the viewer renders when present.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint contracts
// ─────────────────────────────────────────────────────────────────────────────

/** Visit type accepted by the consent endpoint. Distinct from the claims domain's `VisitType`. */
export type ShrVisitType = 'IP' | 'OP';

/**
 * How a representative relates to the patient they consent for. Exactly the
 * four values DHA accepts — anything else is rejected upstream.
 */
export type ShrRepresentativeRelationship = 'Healthcare Proxy' | 'Sibling' | 'Principal' | 'Other';

export const SHR_REPRESENTATIVE_RELATIONSHIPS: ShrRepresentativeRelationship[] = [
  'Healthcare Proxy',
  'Sibling',
  'Principal',
  'Other',
];

/** The patient's decision, as recorded on the verify call. */
export type ShrConsentDecision = 'Approve' | 'Reject';
export interface CreateConsentRequest {
  crId: string;
  locationUuid: string;
  requestedBy: string;
  visitType: ShrVisitType;
  emergency: 0 | 1;
  /** 1 = the patient can consent for themselves (the default). 0 requires a representative. */
  patientCapable?: 0 | 1;
  incapacityReason?: string;
  representativeCrId?: string;
  representativeRelationship?: ShrRepresentativeRelationship;
}

/**
 * Response from `POST /shr/consents`. Two shapes, and which arrived decides
 * what happens next:
 *
 *  - **standard** — `otp_record` and no token, so the OTP step follows
 *  - **emergency** — approved on the spot, so `consent_token` + `visit_id`
 *    arrive with no `otp_record` and there is no OTP step to run
 */
export interface CreateConsentResponse {
  consent_id: string;
  consent_status: string;
  /**
   * Opaque handle that must be echoed back to the verify endpoint. Absent on an
   * emergency consent, which needs no password.
   */
  otp_record?: string;
  visit_type: string;
  /** Only on an emergency consent, which is approved without an OTP. */
  consent_token?: string;
  /** Only on an emergency consent; a standard consent gets it at verification. */
  visit_id?: string;
  /** Whether consent was granted through the emergency route. */
  emergency?: boolean;
  message?: string;
  status?: string;
}

/**
 * Body for `POST {hieBaseUrl}/shr/consents/{consent_id}/verify`.
 *
 * One endpoint, three jobs: approving a consent with the OTP, recording a
 * *refusal*, and completing an OTP-gated visit closure. `otpRecord` identifies
 * which — it comes from the consent request for the first two and from the
 * close call for the third.
 *
 * `otp` is optional because a refusal has none: a patient who declines never
 * hands over a password.
 *
 * `crId` is not forwarded to DHA — the backend uses it to record the consent
 * session that `GET /shr/consents/active` later answers from, so send it.
 */
export interface VerifyConsentRequest {
  locationUuid: string;
  otpRecord: string;
  otp?: string;
  consentDecision?: ShrConsentDecision;
  rejectionReason?: string;
  crId?: string;
}

/**
 * Response from the verify endpoint. Three real outcomes, so everything but the
 * envelope is optional and callers must branch on what actually arrived rather
 * than assuming a 200 means "here's a token":
 *
 *  - **approval** — `consent_token` + `visit_id`. `visit_id` is the only source
 *    of the visit UUID needed to close the visit later.
 *  - **refusal** — `consent_id` + `consent_status: 'Rejected'`, no token, no
 *    visit opened.
 *  - **closure completion** — `end_date`, no token; the visit this verified is
 *    now closed.
 */
export interface VerifyConsentResponse {
  consent_token?: string;
  visit_id?: string;
  consent_id?: string;
  consent_status?: string;
  /** Present only when this verification completed an OTP-gated closure. */
  end_date?: string;
  message?: string;
  status?: string;
}

/** What a granted consent hands to whoever fetches and renders the records. */
export interface ShrConsentGrant {
  consentToken: string;
  visitId: string;
}

/**
 * What a *refused* consent hands back. Neither an error nor a session: the
 * request settled, no visit was opened, and nothing will be fetched.
 */
export interface ShrConsentDeclined {
  consentId: string;
  consentStatus: string;
  rejectionReason?: string;
}

/**
 * Body for `POST {hieBaseUrl}/shr/visits/{visit_id}/close`. Everything past
 * `locationUuid` is optional: omitted, closure is OTP-gated as before.
 *
 * **Polarity gotcha.** This is `patientIncapable` — `1` means the patient
 * *cannot* consent. The consent request uses `patientCapable`, where `1` means
 * they *can*. Two similarly named flags on different endpoints with opposite
 * polarity; `patientIncapable: 1` here and `patientCapable: 0` there say the
 * same thing.
 */
export interface CloseVisitRequest {
  locationUuid: string;
  /** 1 = the patient cannot consent to the closure (unconscious, deceased). Closes immediately, no OTP. */
  patientIncapable?: 0 | 1;
  /** Required alongside `patientIncapable: 1`. */
  incapacityReason?: string;
}

/**
 * Response from `POST {hieBaseUrl}/shr/visits/{visit_id}/close`. Two outcomes,
 * and which field arrived decides what happens next:
 *
 *  - `end_date` — the visit is **already closed**.
 *  - `otp_record` — a closure OTP went out and the visit **stays open** until
 *    that password is verified through the verify endpoint.
 */
export interface CloseVisitResponse {
  consent_id?: string;
  /** Server-supplied closure date — the visit is closed. */
  end_date?: string;
  /** A closure awaiting verification. The visit is NOT closed yet. */
  otp_record?: string;
  visit_id?: string;
  message?: string;
  status?: string;
}

/** Response from `GET {hieBaseUrl}/shr/open-visits`. Empty array means none. */
export interface OpenVisitsResponse {
  visits?: Array<{ visit_id?: string }>;
  message?: string;
  status?: string;
}

/**
 * Response from the backend's own `GET {hieBaseUrl}/shr/consents/active` — its
 * shape, not DHA's. `hasActiveConsent: false` is a normal answer meaning a
 * fresh consent request is needed, not an error.
 */
export interface ActiveConsentResponse {
  hasActiveConsent: boolean;
  message?: string;
  source?: 'local' | 'refreshed' | 'open-visits';
  visitId?: string;
  consentId?: string | null;
  consentToken?: string;
  tokenExpiresAt?: string | null;
}

/** Response from `POST {hieBaseUrl}/shr/visits/{visit_id}/refresh`. */
export interface RefreshConsentResponse {
  consent_token?: string;
  message?: string;
  status?: string;
}

/** Discriminated error thrown by every SHR call, carrying the real HTTP status. */
export class ShrApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ShrApiError';
    this.status = status;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FHIR shapes returned by the SHR
// ─────────────────────────────────────────────────────────────────────────────

export interface ShrMeta {
  versionId?: string;
  lastUpdated?: string;
  source?: string;
  profile?: string[];
}

export interface ShrCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface ShrCodeableConcept {
  coding?: ShrCoding[];
  text?: string;
}

export interface ShrIdentifier {
  use?: string;
  system?: string;
  value?: string;
  type?: ShrCodeableConcept;
}

export interface ShrReference {
  reference?: string;
  type?: string;
  identifier?: ShrIdentifier;
  display?: string;
}

export interface ShrPeriod {
  start?: string;
  end?: string;
}

export interface ShrAnnotation {
  authorString?: string;
  time?: string;
  text?: string;
}

export interface ShrQuantity {
  value?: number;
  unit?: string;
  code?: string;
}

export interface ShrDosageInstruction {
  text?: string;
  timing?: {
    repeat?: {
      duration?: number;
      durationUnit?: string;
      frequency?: number;
      period?: number;
      periodUnit?: string;
    };
    code?: ShrCodeableConcept;
  };
  asNeededBoolean?: boolean;
  route?: ShrCodeableConcept;
  doseAndRate?: Array<{ doseQuantity?: ShrQuantity }>;
}

export interface ShrDispenseRequest {
  validityPeriod?: ShrPeriod;
  numberOfRepeatsAllowed?: number;
  quantity?: ShrQuantity;
}

/** Base every SHR resource shares. */
interface ShrResourceBase {
  resourceType: string;
  id?: string;
  meta?: ShrMeta;
  identifier?: ShrIdentifier[];
}

export interface ShrPatient extends ShrResourceBase {
  resourceType: 'Patient';
  name?: Array<{ text?: string; family?: string; given?: string[] }>;
  gender?: string;
  birthDate?: string;
}

export interface ShrEncounter extends ShrResourceBase {
  resourceType: 'Encounter';
  status?: string;
  class?: ShrCoding;
  type?: ShrCodeableConcept[];
  priority?: ShrCodeableConcept;
  subject?: ShrReference;
  participant?: Array<{ individual?: { identifier?: ShrIdentifier; display?: string } }>;
  period?: ShrPeriod;
  serviceProvider?: ShrReference;
}

export interface ShrCondition extends ShrResourceBase {
  resourceType: 'Condition';
  clinicalStatus?: ShrCodeableConcept;
  verificationStatus?: ShrCodeableConcept;
  category?: ShrCodeableConcept[];
  severity?: ShrCodeableConcept;
  code?: ShrCodeableConcept;
  subject?: ShrReference;
  encounter?: ShrReference;
  onsetDateTime?: string;
  recordedDate?: string;
  note?: ShrAnnotation[];
}

export interface ShrServiceRequest extends ShrResourceBase {
  resourceType: 'ServiceRequest';
  contained?: ShrAnyResource[];
  basedOn?: Array<{ type?: string; identifier?: ShrIdentifier }>;
  status?: string;
  intent?: string;
  /** Not present in every payload seen so far; rendered only when the SHR sends it. */
  code?: ShrCodeableConcept;
  category?: ShrCodeableConcept[];
  priority?: string;
  subject?: ShrReference;
  encounter?: ShrReference;
  occurrencePeriod?: ShrPeriod;
  occurrenceDateTime?: string;
  authoredOn?: string;
  requester?: ShrReference;
  performer?: ShrReference[];
  reasonCode?: ShrCodeableConcept[];
  supportingInfo?: ShrReference[];
  note?: ShrAnnotation[];
}

export interface ShrObservation extends ShrResourceBase {
  resourceType: 'Observation';
  status?: string;
  code?: ShrCodeableConcept;
  subject?: ShrReference;
  encounter?: ShrReference;
  valueCodeableConcept?: ShrCodeableConcept;
  /**
   * Only `valueCodeableConcept` is confirmed on the payloads seen so far. The
   * remaining value/date variants are standard FHIR and are rendered when the
   * SHR happens to send them, rather than assumed to be there.
   */
  valueQuantity?: ShrQuantity;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  effectiveDateTime?: string;
  effectivePeriod?: ShrPeriod;
  issued?: string;
  interpretation?: ShrCodeableConcept[];
  note?: ShrAnnotation[];
}

export interface ShrSpecimen extends ShrResourceBase {
  resourceType: 'Specimen';
  status?: string;
  type?: ShrCodeableConcept;
  subject?: ShrReference;
  receivedTime?: string;
  collection?: {
    collectedDateTime?: string;
    collector?: ShrReference;
    bodySite?: ShrCodeableConcept;
  };
  note?: ShrAnnotation[];
}

export interface ShrMedicationRequest extends ShrResourceBase {
  resourceType: 'MedicationRequest';
  status?: string;
  intent?: string;
  priority?: string;
  medicationCodeableConcept?: ShrCodeableConcept;
  subject?: ShrReference;
  encounter?: ShrReference;
  authoredOn?: string;
  requester?: ShrReference;
  note?: ShrAnnotation[];
  dosageInstruction?: ShrDosageInstruction[];
  dispenseRequest?: ShrDispenseRequest;
}

/**
 * Any resource the SHR may hand back. The union covers the seven confirmed
 * types; the index signature keeps a site-configured extra category (once the
 * backend confirms one) from being a type error rather than a config change.
 */
export type ShrKnownResource =
  ShrPatient | ShrEncounter | ShrCondition | ShrServiceRequest | ShrObservation | ShrSpecimen | ShrMedicationRequest;

export type ShrAnyResource = ShrKnownResource | (ShrResourceBase & Record<string, any>);

export interface ShrBundleEntry {
  fullUrl?: string;
  resource?: ShrAnyResource;
  search?: { mode?: string };
  request?: { method?: string; url?: string };
}

export interface ShrBundle {
  resourceType: 'Bundle';
  id?: string;
  meta?: ShrMeta;
  type?: string;
  total?: number;
  timestamp?: string;
  link?: Array<{ relation?: string; url?: string }>;
  entry?: ShrBundleEntry[];
}

/** Normalised result of a patient-records fetch, ready for the viewer. */
export interface ShrRecordSet {
  /** Every resource found in the response, flattened out of whatever envelope carried it. */
  resources: ShrAnyResource[];
  /** Newest `meta.lastUpdated` across the set, if any resource carried one. */
  lastUpdated?: string;
  /** Distinct non-empty `meta.source` values across the set. */
  sources: string[];
  /** The response exactly as received — kept for diagnostics, never rendered. */
  raw: unknown;
}
