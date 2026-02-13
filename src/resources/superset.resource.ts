import { getEtlBaseUrl } from '../shared/utils/get-base-url';

export async function fetchGuestToken(locationUuid: string): Promise<string> {
  const etlBaseUrl = await getEtlBaseUrl();
  const response = await fetch(`${etlBaseUrl}/superset-token?location_uuid=${locationUuid}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch guest token: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}
