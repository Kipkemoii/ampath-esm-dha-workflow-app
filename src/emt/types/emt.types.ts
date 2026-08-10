import type { HieClient } from '../../registry/types';

/**
 * A single pending EMT / ambulance referral as returned by
 * `GET {hieBaseUrl}/emt/referrals`. Sample payload:
 *
 * ```json
 * {
 *   "submission_id": 77,
 *   "cr_id": "CR4089468813472-8",
 *   "status": "pending_acceptance",
 *   "incident_id": "INC-1786295440",
 *   "dispatch_id": "5aee41d2-7cb9-4a56-991f-6c014428819a",
 *   "case_number": "AMB-5aee41d2-7cb9-4a56-991f-6c014428819a-FAC",
 *   "ambulance_fr_code": "FID-AMB-916293-3",
 *   "ambulance_registration_number": "GKB 847V",
 *   "facility_fr_code": "FID-01-116951-6",
 *   "evacuation_scene": "Nairobi Central",
 *   "priority": "p1 life threatening (als) with altered consciousness",
 *   "referral_reason": "",
 *   "referral_category": "",
 *   "transport_modality": "",
 *   "referral_notes": "Chief complaint: Seizures. History of present illness: Witnessed seizure at scene. Medical history: None reported",
 *   "bundle_id": "5aee41d2-7cb9-4a56-991f-6c014428819a",
 *   "encounter_ref": "b64ff563-5ed6-4c9e-885d-3de53ae9d3f9",
 *   "interventions": ["SHA-01-001"],
 *   "requested_at": "2026-08-09T21:56:23.206621Z",
 *   "updated_at": "2026-08-09T21:56:24.978157Z"
 * }
 * ```
 *
 * `visit_id` and `encounter_ref` are only present once the referral has an
 * associated AMRS visit / resolved HIE encounter — earlier-stage submissions omit them.
 */
export interface EmtReferral {
  submission_id: number;
  cr_id: string;
  status: EmtReferralStatus;
  incident_id: string;
  dispatch_id: string;
  case_number: string;
  ambulance_fr_code: string;
  ambulance_registration_number: string;
  facility_fr_code: string;
  evacuation_scene: string;
  /** Free-text triage priority, e.g. "p1 life threatening (als) with altered consciousness". */
  priority: string;
  referral_reason: string;
  referral_category: string;
  transport_modality: string;
  referral_notes: string;
  bundle_id: string;
  /** Present once an AMRS visit has been started for this referral. */
  visit_id?: string;
  /** Present once the originating HIE encounter has been resolved. */
  encounter_ref?: string;
  interventions: string[];
  requested_at: string;
  updated_at: string;
}

export type EmtReferralStatus =
  | 'pending_acceptance'
  | 'accepted'
  | 'rejected'
  | 'handed_over'
  | string;

/** Paginated envelope returned by the pending-list endpoint. */
export interface EmtReferralListResponse {
  results: EmtReferral[];
  count: number;
  limit: number;
  offset: number;
}

/** The receiving doctor's regulatory identifier — sent to `handover/initiate`. */
export interface ReceivingDoctor {
  /** Display name, surfaced in the confirmation step (not sent to the API). */
  name: string;
  /** e.g. the KMPDC registration number ("A13579"). */
  identifier: string;
  identifier_type: string;
  /** Licensing body, e.g. "KMPDC" | "COC" | "NCK". */
  regulator: string;
}

/** Request body for `POST /api/v1/claims/emt/handover/initiate`. */
export interface InitiateHandoverRequest {
  incidenceNumber: string;
  identifier: string;
  identifier_type: string;
  regulator: string;
  /** The current facility's OpenMRS location uuid — the backend scopes the handover to it. */
  locationUuid: string;
}

/** Response from `handover/initiate` — carries the request id needed to verify. */
export interface InitiateHandoverResponse {
  request_id?: string;
  requestId?: string;
  [key: string]: unknown;
}

/** Request body for `POST /api/v1/claims/emt/handover/verify`. */
export interface VerifyHandoverRequest {
  incidenceNumber: string;
  request_id: string;
  otp: string;
  /** The current facility's OpenMRS location uuid — the backend scopes the handover to it. */
  locationUuid: string;
}

/**
 * A referral row enriched with its lazily-fetched Client Registry record,
 * so the queue can show a human-readable patient instead of a bare `cr_id`.
 */
export interface EmtReferralRow extends EmtReferral {
  /** Display name resolved from CR (falls back to the cr_id). */
  patientName: string;
  /** True while the CR record is being fetched for this row. */
  crLoading: boolean;
  /** Set if the CR lookup for this row failed — the row degrades gracefully. */
  crError?: string;
  /** The full CR record when available. */
  client?: HieClient;
}

/** Discriminated error thrown by the EMT resource for branchable UI handling. */
export class EmtApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'EmtApiError';
    this.status = status;
  }
}
