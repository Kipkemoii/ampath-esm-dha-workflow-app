/**
 * Tests for the EMT resource layer: fetchPendingReferrals, initiateHandover,
 * verifyHandoverOtp, and normalizeError.
 *
 * We mock `../shared/utils/get-base-url` (`getHieBaseUrl`) and
 * `@openmrs/esm-framework` (`openmrsFetch`) directly since `emt.resource.ts`
 * calls them — this avoids loading the heavy OpenMRS module graph.
 */
jest.mock('../shared/utils/get-base-url', () => ({
  getHieBaseUrl: jest.fn(),
}));

jest.mock('@openmrs/esm-framework', () => ({
  openmrsFetch: jest.fn(),
}));

import { openmrsFetch } from '@openmrs/esm-framework';
import { getHieBaseUrl } from '../shared/utils/get-base-url';
import {
  fetchPendingReferrals,
  initiateHandover,
  verifyHandoverOtp,
  normalizeError,
  getHandoverRequestId,
} from './emt.resource';
import { EmtApiError } from './types/emt.types';

const mockOpenmrsFetch = jest.mocked(openmrsFetch);
const mockGetHieBaseUrl = jest.mocked(getHieBaseUrl);

const BASE_URL = 'http://localhost:3000';

const referralFixture = {
  submission_id: 3,
  cr_id: 'CR5617849204955-8',
  status: 'pending_acceptance',
  incident_id: 'INC-20260803100645-254727092999-ffjotq',
  dispatch_id: 'd22419d8-6d36-4b2f-a33c-3e008bd85f77',
  case_number: 'AMB-d22419d8-6d36-4b2f-a33c-3e008bd85f77-FAC',
  ambulance_fr_code: 'FID-AMB-916293-3',
  ambulance_registration_number: 'KDN 085T',
  facility_fr_code: 'FID-47-108521-3',
  evacuation_scene: '',
  priority: 'p1 life threatening (als) with altered consciousness',
  referral_reason: '',
  referral_category: '',
  transport_modality: '',
  referral_notes: 'Chief complaint: Test.',
  bundle_id: 'd22419d8-6d36-4b2f-a33c-3e008bd85f77',
  interventions: ['SHA-01-001'],
  requested_at: '2026-08-04T09:37:39.438967Z',
  updated_at: '2026-08-04T09:37:40.428903Z',
};

const listFixture = {
  results: [referralFixture],
  count: 1,
  limit: 50,
  offset: 0,
};

/** Mimics what `openmrsFetch` actually throws for a non-2xx response. */
function fetchError(status: number, message = `Server responded with ${status}`) {
  return { response: { status }, message };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockGetHieBaseUrl.mockResolvedValue(BASE_URL);
});

// ── fetchPendingReferrals ─────────────────────────────────────────────

describe('fetchPendingReferrals', () => {
  it('requests the referrals endpoint with limit, offset, and the facility locationUuid', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: listFixture } as any);

    const data = await fetchPendingReferrals(50, 0, 'location-uuid-1');

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      `${BASE_URL}/emt/referrals?limit=50&offset=0&locationUuid=location-uuid-1`,
      { method: 'GET' },
    );
    expect(data.results).toHaveLength(1);
    expect(data.results[0].cr_id).toBe('CR5617849204955-8');
    expect(data.count).toBe(1);
  });

  it('normalises a malformed envelope gracefully', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results: undefined, count: 'bad' } } as any);

    const data = await fetchPendingReferrals(undefined, undefined, 'location-uuid-1');
    expect(data.results).toEqual([]);
    expect(data.count).toBe(0);
  });

  it('re-throws as an EmtApiError carrying the real HTTP status', async () => {
    mockOpenmrsFetch.mockRejectedValueOnce(fetchError(401, 'Token expired'));

    await expect(fetchPendingReferrals()).rejects.toMatchObject({ status: 401 });
  });
});

// ── initiateHandover ───────────────────────────────────────────────────

describe('initiateHandover', () => {
  it('POSTs to /handover/initiate with the request body', async () => {
    const responseFixture = { request_id: '82fd22b6-e366-4077-9866-e1c4ed7328b0' };
    mockOpenmrsFetch.mockResolvedValueOnce({ data: responseFixture } as any);

    const res = await initiateHandover({
      incidenceNumber: 'AMB-d22419d8-FAC',
      identifier: 'A13579',
      identifier_type: 'registration_number',
      regulator: 'KMPDC',
      locationUuid: 'location-uuid-1',
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      `${BASE_URL}/emt/handover/initiate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          incidenceNumber: 'AMB-d22419d8-FAC',
          identifier: 'A13579',
          identifier_type: 'registration_number',
          regulator: 'KMPDC',
          locationUuid: 'location-uuid-1',
        },
      },
    );
    expect(res.request_id).toBe('82fd22b6-e366-4077-9866-e1c4ed7328b0');
  });

  it('wraps a 409 conflict as EmtApiError(409)', async () => {
    mockOpenmrsFetch.mockRejectedValueOnce(fetchError(409, 'Handover already initiated'));

    try {
      await initiateHandover({
        incidenceNumber: 'AMB-d22419d8-FAC',
        identifier: 'A13579',
        identifier_type: 'registration_number',
        regulator: 'KMPDC',
        locationUuid: 'location-uuid-1',
      });
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(EmtApiError);
      expect((err as EmtApiError).status).toBe(409);
    }
  });
});

// ── verifyHandoverOtp ──────────────────────────────────────────────────

describe('verifyHandoverOtp', () => {
  it('POSTs to /handover/verify with incidenceNumber, request_id, and otp', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { status: 'verified' } } as any);

    await verifyHandoverOtp({
      incidenceNumber: 'AMB-d22419d8-FAC',
      request_id: '82fd22b6-e366-4077-9866-e1c4ed7328b0',
      otp: '623415',
      locationUuid: 'location-uuid-1',
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      `${BASE_URL}/emt/handover/verify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          incidenceNumber: 'AMB-d22419d8-FAC',
          request_id: '82fd22b6-e366-4077-9866-e1c4ed7328b0',
          otp: '623415',
          locationUuid: 'location-uuid-1',
        },
      },
    );
  });

  it('wraps an expired/invalid OTP (410) as EmtApiError(410)', async () => {
    mockOpenmrsFetch.mockRejectedValueOnce(fetchError(410, 'OTP expired'));

    try {
      await verifyHandoverOtp({
        incidenceNumber: 'AMB-d22419d8-FAC',
        request_id: '82fd22b6-e366-4077-9866-e1c4ed7328b0',
        otp: '000000',
        locationUuid: 'location-uuid-1',
      });
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(EmtApiError);
      expect((err as EmtApiError).status).toBe(410);
    }
  });
});

// ── normalizeError ────────────────────────────────────────────────────

describe('normalizeError', () => {
  it('reads the real HTTP status off an openmrsFetch-style error', () => {
    const err = normalizeError(fetchError(404, 'Case not found'));
    expect(err).toBeInstanceOf(EmtApiError);
    expect(err.status).toBe(404);
    expect(err.message).toBe('Case not found');
  });

  it('prefers a JSON responseBody.message when present', () => {
    const err = normalizeError({
      response: { status: 422 },
      message: 'Server responded with 422',
      responseBody: { message: 'identifier is required' },
    });
    expect(err.status).toBe(422);
    expect(err.message).toBe('identifier is required');
  });

  it('returns status 0 for network / non-HTTP errors', () => {
    const err = normalizeError(new Error('NetworkError: Failed to fetch'));
    expect(err).toBeInstanceOf(EmtApiError);
    expect(err.status).toBe(0);
  });

  it('passes an already-typed EmtApiError through unchanged', () => {
    const original = new EmtApiError(409, 'Already handled');
    expect(normalizeError(original)).toBe(original);
  });
});

// ── getHandoverRequestId ──────────────────────────────────────────────

describe('getHandoverRequestId', () => {
  it('returns request_id (snake_case)', () => {
    expect(getHandoverRequestId({ request_id: 'abc' })).toBe('abc');
  });

  it('falls back to requestId (camelCase)', () => {
    expect(getHandoverRequestId({ requestId: 'def' })).toBe('def');
  });

  it('returns empty string when neither is present', () => {
    expect(getHandoverRequestId({})).toBe('');
  });
});
