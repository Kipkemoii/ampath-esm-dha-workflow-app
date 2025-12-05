import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type CreateVisitDto } from '../registry/types';

export async function createVisit(createVisitDto: CreateVisitDto) {
  const url = `${restBaseUrl}/visit`;
  const response = await openmrsFetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(createVisitDto),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return response.json();
}
