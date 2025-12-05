import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type PatientSearchResponse } from '../registry/types';

export async function searchPatientByCrNumber<T>(cr_id: string): Promise<PatientSearchResponse> {
  const url = `${restBaseUrl}/patient`;
  const params = {
    q: cr_id,
    v: 'full',
    includeDead: 'true',
    limit: '10',
    totalCount: 'true',
  };
  const queryString = new URLSearchParams(params).toString();
  const response = await openmrsFetch(`${url}?${queryString}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return response.json();
}
