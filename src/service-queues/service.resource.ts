import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type ServiceQueue } from '../registry/types';
import { type TransitionQueueEntryDto } from '../types/types';

export async function getServiceQueueByLocation(locationUuid: string): Promise<ServiceQueue[]> {
  const params = {
    v: 'custom:(uuid,name)',
    location: locationUuid,
  };
  const queryString = new URLSearchParams(params).toString();
  const queueEntryUrl = `${restBaseUrl}/queue`;
  const response = await openmrsFetch(`${queueEntryUrl}?${queryString}`);
  const result = await response.json();
  return result.results;
}

export async function transitionQueueEntry(transitionQueueEntryDto: TransitionQueueEntryDto) {
  const url = `${restBaseUrl}/queue-entry/transition`;
  const resp = await openmrsFetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(transitionQueueEntryDto),
  });
  const res = await resp.json();
  return res;
}
