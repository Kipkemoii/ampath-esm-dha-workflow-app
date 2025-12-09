import { type Encounter, formatDate, openmrsFetch, parseDate, restBaseUrl, useSession } from '@openmrs/esm-framework';
import {
  type QueueEntryResponse,
  type Identifer,
  type MappedEncounter,
  type MappedVisitQueueEntry,
  type QueueEntry,
} from '../types/types';
import dayjs from 'dayjs';
import useSWR from 'swr';
import { useMemo } from 'react';
import { ETL_BASE_URL } from '../shared/constants';
import { type QueueEntryResult } from '../registry/types';

export function serveQueueEntry(servicePointName: string, ticketNumber: string, status: string) {
  const abortController = new AbortController();

  return openmrsFetch(`${restBaseUrl}/queueutil/assignticket`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: {
      servicePointName,
      ticketNumber,
      status,
    },
  });
}

const mapEncounterProperties = (encounter: Encounter): MappedEncounter => ({
  diagnoses: encounter.diagnoses,
  encounterDatetime: encounter.encounterDatetime,
  encounterType: encounter.encounterType.display,
  obs: encounter.obs,
  provider: encounter.encounterProviders[0]?.provider?.person?.display,
  uuid: encounter.uuid,
  voided: encounter.voided,
});

export const mapVisitQueueEntryProperties = (
  queueEntry: QueueEntry,
  visitQueueNumberAttributeUuid: string,
): MappedVisitQueueEntry => ({
  id: queueEntry.uuid,
  encounters: queueEntry.visit?.encounters?.map(mapEncounterProperties),
  name: queueEntry.display,
  patientUuid: queueEntry.patient.uuid,
  patientAge: queueEntry.patient.person?.age + '',
  patientDob: queueEntry?.patient?.person?.birthdate
    ? formatDate(parseDate(queueEntry.patient.person.birthdate), { time: false })
    : '--',
  patientGender: queueEntry.patient.person.gender,
  queue: queueEntry.queue,
  priority: queueEntry.priority,
  priorityComment: queueEntry.priorityComment,
  status: queueEntry.status,
  startedAt: dayjs(queueEntry.startedAt).toDate(),
  endedAt: queueEntry.endedAt ? dayjs(queueEntry.endedAt).toDate() : null,
  visitType: queueEntry.visit?.visitType?.display,
  queueLocation: (queueEntry?.queue as any)?.location?.uuid,
  visitTypeUuid: queueEntry.visit?.visitType?.uuid,
  visitUuid: queueEntry.visit?.uuid,
  queueUuid: queueEntry.queue.uuid,
  queueEntryUuid: queueEntry.uuid,
  sortWeight: queueEntry.sortWeight,
  visitQueueNumber: queueEntry.visit?.attributes?.find((e) => e?.attributeType?.uuid === visitQueueNumberAttributeUuid)
    ?.value,
  identifiers: queueEntry.patient?.identifiers as Identifer[],
  queueComingFrom: queueEntry?.queueComingFrom?.name,
});

export function useQueueEntries(queue: string) {
  // const queueEntryBaseUrl = `${restBaseUrl}/queue-entry?` +
  // `isEnded=false&service=7f7ec7ad-cdd7-4ed9-bc2e-5c5bd9f065b2&location=18c343eb-b353-462a-9139-b16606e6b6c2`;
  const queueEntryBaseUrl = `${restBaseUrl}/queue-entry?` + `isEnded=false&queue=${queue}`;
  const {
    data,
    isValidating,
    isLoading,
    error: pageError,
  } = useSWR<QueueEntryResponse, Error>(queueEntryBaseUrl, openmrsFetch);

  const queueEntries = useMemo(() => data, [data]);

  return {
    queueEntries,
    isLoading,
  };
}

export function useQueues(service: string = '7f7ec7ad-cdd7-4ed9-bc2e-5c5bd9f065b2') {
  const currentUserSession = useSession();
  const location = currentUserSession?.sessionLocation?.uuid;

  const customRepresentation = 'custom:(uuid,display,name)';

  const apiUrl =
    `${restBaseUrl}/queue?&service=${service}` +
    (location ? `&location=${location}` : '') +
    `&v=${customRepresentation}`;

  const { data, isLoading } = useSWR<
    {
      data: {
        results: Array<{
          uuid: string;
          display: string;
          name: string;
        }>;
      };
    },
    Error
  >(service ? apiUrl : null, openmrsFetch);

  return { data, isLoading };
}

export function useQueue(service: string = '7f7ec7ad-cdd7-4ed9-bc2e-5c5bd9f065b2') {
  const currentUserSession = useSession();
  const location = currentUserSession?.sessionLocation?.uuid;

  const customRepresentation = 'custom:(uuid,display,name)';

  const apiUrl =
    `${restBaseUrl}/queue?&service=${service}` +
    (location ? `&location=${location}` : '') +
    `&v=${customRepresentation}`;

  const { data, isLoading } = useSWR<
    {
      data: {
        results: Array<{
          uuid: string;
          display: string;
          name: string;
        }>;
      };
    },
    Error
  >(service ? apiUrl : null, openmrsFetch);

  return { data, isLoading };
}

export async function getServiceQueueByLocationUuid(
  serviceUuid: string,
  locationUuid: string,
): Promise<QueueEntryResult[]> {
  const queueEntryUrl = `${ETL_BASE_URL}/queue-entry`;
  const params = {
    locationUuid: locationUuid,
    serviceUuid: serviceUuid,
  };
  const queryString = new URLSearchParams(params).toString();
  const response = await openmrsFetch(`${queueEntryUrl}?${queryString}`);
  const result = await response.json();
  return result.data;
}
