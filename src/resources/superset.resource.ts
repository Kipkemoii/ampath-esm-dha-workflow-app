import { openmrsFetch } from '@openmrs/esm-framework';
import { getEtlBaseUrl } from '../shared/utils/get-base-url';

export async function fetchGuestToken(locationUuid: string): Promise<string> {
  const etlBaseUrl = await getEtlBaseUrl();
  const supersetTokenUrl = `${etlBaseUrl}/superset-token`;
  const params = {
    locationUuid: locationUuid,
  };
  const queryString = new URLSearchParams(params).toString();
  const response = await openmrsFetch(`${supersetTokenUrl}?${queryString}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch guest token: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}
