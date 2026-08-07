import type { HieClient } from '../../registry/types';

/**
 * A single pending EMT / ambulance referral as returned by
 * `GET /api/v1/claims/emt/pending`.
 */
export interface EmtReferral {
  submission_id: number;
  cr_id: string;
  status: EmtReferralStatus;
  case_number: string;
  ambulance_fr_code: string;
  facility_fr_code: string;
  evacuation_scene: string;
  referral_reason: string;
  referral_category: string;
  transport_modality: string;
  referral_notes: string;
  bundle_id: string;
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
  incidence_number: string;
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
  incidence_number: string;
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
