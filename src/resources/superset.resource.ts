import { openmrsFetch } from '@openmrs/esm-framework';
import { getEtlBaseUrl } from '../shared/utils/get-base-url';
import { showSnackbar } from '@openmrs/esm-styleguide';

export async function fetchGuestToken(locationUuid: string, dashboardId: string): Promise<string | null> {
  try {
    const etlBaseUrl = await getEtlBaseUrl();
    const supersetTokenUrl = `${etlBaseUrl}/superset-token`;

    const params = {
      locationUuid,
      dashboardId,
    };

    const queryString = new URLSearchParams(params).toString();
    const response = await openmrsFetch(`${supersetTokenUrl}?${queryString}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch guest token: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data?.access_token) {
      throw new Error('Guest token response did not contain an access_token');
    }

    return data.access_token;
  } catch (error) {
    console.error('Error fetching Superset guest token:', error);

    showSnackbar({
      title: 'Error fetching Superset guest token',
      subtitle: error instanceof Error ? error.message : 'Failed to fetch guest token',
      kind: 'error',
    });

    return null;
  }
}
