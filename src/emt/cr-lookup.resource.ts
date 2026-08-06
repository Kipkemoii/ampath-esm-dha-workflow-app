import { fetchClientRegistryData } from '../registry/registry.resource';
import { HieIdentificationType, type HieClient } from '../registry/types';

/**
 * Client Registry lookup for an EMT referral.
 *
 * The referral only carries a `cr_id` (the CR record's id). We fetch the full
 * CR record so the queue can show a human-readable patient (name, sex, DOB,
 * national ID, …) instead of a bare identifier.
 *
 * The CR is only queryable through its search endpoint, so we reuse the
 * established `fetchClientRegistryData` search with `identificationType: 'id'`
 * (`HieIdentificationType.Cr`) — the same identification type the rest of the
 * app uses when it already holds a CR id. The search returns an array; a CR id
 * is unique, so the first entry is the record we want.
 *
 * Lookups are done lazily per-row (on expand / on render of a small page) so a
 * single failed or slow CR fetch never blocks the whole queue.
 */
export async function fetchClientByCrId(crId: string, locationUuid: string): Promise<HieClient | null> {
  if (!crId || !locationUuid) return null;
  try {
    const result = await fetchClientRegistryData({
      identificationNumber: crId,
      identificationType: HieIdentificationType.Cr,
      locationUuid,
    });
    return Array.isArray(result) && result.length > 0 ? (result[0] as HieClient) : null;
  } catch {
    // Graceful degradation: a missing CR record must not break the queue row.
    // Callers surface "patient details unavailable" and keep the cr_id visible.
    return null;
  }
}

/** Display name from a CR record, falling back gracefully. */
export function clientDisplayName(client: HieClient | null | undefined, crId: string): string {
  if (!client) return crId;
  return [client.first_name, client.middle_name, client.last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || crId;
}
