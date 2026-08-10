import useSWR from 'swr';
import { openmrsFetch } from '@openmrs/esm-framework';
import { getHieBaseUrl } from '../shared/utils/get-base-url';
import {
  EmtApiError,
  type EmtReferral,
  type EmtReferralListResponse,
  type InitiateHandoverRequest,
  type InitiateHandoverResponse,
  type VerifyHandoverRequest,
} from './types/emt.types';

/**
 * EMT / Referral data source.
 *
 * Endpoints are relative to the configured HIE base URL — `getHieBaseUrl()`,
 * the same helper `registry.resource.ts`'s CR search and `preauth.resource.ts`'s
 * HWR search already use — and go through `openmrsFetch`, so auth rides the
 * real, current OpenMRS session instead of a hand-copied, expiring token.
 */

const EMT_BASE = '/emt';

/** SWR cache key prefix for the pending-referrals list (used for invalidation). */
export const EMT_PENDING_KEY = 'emt-pending-referrals';

/** Default auto-refresh interval for the queue. SWR is the polling mechanism. */
export const EMT_POLL_INTERVAL_MS = 30_000;

/**
 * Fetch a page of pending EMT referrals.
 *
 * The endpoint is server-paginated (`limit`/`offset`/`count`) — callers should
 * page against the returned `count`, not assume a single page.
 */
export async function fetchPendingReferrals(
  limit = 50,
  offset = 0,
  locationUuid = '',
): Promise<EmtReferralListResponse> {
  try {
    const hieBaseUrl = await getHieBaseUrl();
    const response = await openmrsFetch<EmtReferralListResponse>(
      `${hieBaseUrl}${EMT_BASE}/referrals?limit=${limit}&offset=${offset}&locationUuid=${encodeURIComponent(locationUuid)}`,
      { method: 'GET' },
    );
    const data = response?.data;
    // Defensively normalise — never let a malformed envelope crash the queue.
    return {
      results: Array.isArray(data?.results) ? data.results : [],
      count: typeof data?.count === 'number' ? data.count : data?.results?.length ?? 0,
      limit: typeof data?.limit === 'number' ? data.limit : limit,
      offset: typeof data?.offset === 'number' ? data.offset : offset,
    };
  } catch (err) {
    throw normalizeError(err);
  }
}

/**
 * SWR hook for the pending-referrals queue.
 *
 * Polls on `EMT_POLL_INTERVAL_MS` (the repo has no global queue-polling
 * convention — SWR focus/reconnect revalidation is the default; here we add an
 * explicit refresh interval since EMT referrals arrive in real time).
 */
export function usePendingReferrals(limit = 50, offset = 0, locationUuid = '') {
  const key = `${EMT_PENDING_KEY}:${limit}:${offset}:${locationUuid}`;
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    key,
    () => fetchPendingReferrals(limit, offset, locationUuid),
    {
      refreshInterval: EMT_POLL_INTERVAL_MS,
      keepPreviousData: true,
    },
  );

  return {
    referrals: data?.results ?? [],
    count: data?.count ?? 0,
    limit: data?.limit ?? limit,
    offset: data?.offset ?? offset,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}

/**
 * Initiate a handover for a referral. The OTP is sent to the receiving doctor.
 * Returns the `request_id` needed to call `verifyHandoverOtp`.
 */
export async function initiateHandover(
  payload: InitiateHandoverRequest,
): Promise<InitiateHandoverResponse> {
  try {
    const hieBaseUrl = await getHieBaseUrl();
    const response = await openmrsFetch<InitiateHandoverResponse>(
      `${hieBaseUrl}${EMT_BASE}/handover/initiate`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload },
    );
    return response?.data;
  } catch (err) {
    throw normalizeError(err);
  }
}

/** Extract the handover request id regardless of the response's casing. */
export function getHandoverRequestId(res: InitiateHandoverResponse): string {
  return res?.request_id ?? res?.requestId ?? '';
}

/**
 * Verify the OTP entered by the receiving doctor and complete the handover.
 * On success the referral is no longer `pending_acceptance` and the patient's
 * visit should be started.
 */
export async function verifyHandoverOtp(payload: VerifyHandoverRequest) {
  try {
    const hieBaseUrl = await getHieBaseUrl();
    const response = await openmrsFetch(`${hieBaseUrl}${EMT_BASE}/handover/verify`, {
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
 * Map an upstream failure into a typed `EmtApiError` carrying the HTTP status,
 * so the UI can branch on the distinct cases (auth, already-handled, conflict,
 * validation, OTP, …). `openmrsFetch` throws `OpenmrsFetchError`, which carries
 * the real `response.status` — no message-parsing needed. Anything without a
 * status (a raw network failure) is treated as status 0.
 */
export function normalizeError(err: any): EmtApiError {
  if (err instanceof EmtApiError) {
    return err;
  }
  const status = typeof err?.response?.status === 'number' ? err.response.status : 0;
  const message: string =
    (typeof err?.responseBody === 'object' && err?.responseBody?.message) ||
    (typeof err?.message === 'string' && err.message) ||
    'Unexpected error from the EMT service.';
  return new EmtApiError(status, message);
}
