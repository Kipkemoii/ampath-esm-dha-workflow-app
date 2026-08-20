/**
 * Types for the national Shared Health Record (SHR) consent workflow and record viewer.
 *
 * Two groups live here:
 *
 *  1. The four `/shr/*` endpoint contracts (§ create consent, verify OTP, fetch
 *     records, close visit). Field names and casing mirror the real backend
 *     exactly — including `incapavity_reason`, which is misspelled upstream.
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
 * Body for `POST {hieBaseUrl}/shr/consents`.
 *
 * `emergency` is the backend's 0/1 flag rather than a boolean, and
 * `incapavity_reason` is spelled that way upstream — neither is a typo here.
 */
export interface CreateConsentRequest {
  crId: string;
  locationUuid: string;
  requestedBy: string;
  visitType: ShrVisitType;
  emergency: 0 | 1;
  incapavity_reason?: string;
}

/** Response from `POST /shr/consents`. */
export interface CreateConsentResponse {
  consent_id: string;
  consent_status: string;
  /** Opaque handle that must be echoed back to the verify endpoint. */
  otp_record: string;
  visit_type: string;
  message?: string;
  status?: string;
}

/** Body for `POST {hieBaseUrl}/shr/consents/{consent_id}/verify`. */
export interface VerifyConsentRequest {
  otp: string;
  locationUuid: string;
  otpRecord: string;
}

/**
 * Response from the verify endpoint. `visit_id` is the only source of the visit
 * UUID needed to close the visit later — it cannot be derived any other way.
 */
export interface VerifyConsentResponse {
  consent_token: string;
  visit_id: string;
  message?: string;
  status?: string;
}

/** What a granted consent hands to whoever fetches and renders the records. */
export interface ShrConsentGrant {
  consentToken: string;
  visitId: string;
}

/** Response from `POST {hieBaseUrl}/shr/visits/{visit_id}/close`. */
export interface CloseVisitResponse {
  consent_id?: string;
  /** Server-supplied closure date — shown in the "visit closed" state. */
  end_date?: string;
  visit_id?: string;
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
  | ShrPatient
  | ShrEncounter
  | ShrCondition
  | ShrServiceRequest
  | ShrObservation
  | ShrSpecimen
  | ShrMedicationRequest;

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
