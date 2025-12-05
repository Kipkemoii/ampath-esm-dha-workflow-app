import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type QueueEntryDto, type ServiceQueueApiResponse } from '../registry/types';

export async function fetchServiceQueuesByLocationUuid<T>(locationUuid: string): Promise<ServiceQueueApiResponse> {
  const url = `${restBaseUrl}/queue`;
  const params = {
    v: 'custom:(uuid,display,name,description,service:(uuid,display),allowedPriorities:(uuid,display),allowedStatuses:(uuid,display),location:(uuid,display))',
    location: locationUuid,
  };
  const queryString = new URLSearchParams(params).toString();
  const response = await openmrsFetch(`${url}?${queryString}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return response.json();
}

export async function createQueueEntry(createQueueEntryDto: QueueEntryDto) {
  const url = `${restBaseUrl}/visit-queue-entry`;
  const response = await openmrsFetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(createQueueEntryDto),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return response.json();
}
