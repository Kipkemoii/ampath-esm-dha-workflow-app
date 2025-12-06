import useSWR from 'swr';
import { openmrsFetch } from '@openmrs/esm-framework';

import { type Patient } from './types';
export default function useTriagePatients(locationUuid: string) {
  const { data, error, isLoading } = useSWR(
    `https://staging.ampath.or.ke/openmrs/ws/rest/v1/queue-entry?v=custom:(uuid,display,queue:(display,uuid,location:(display,uuid)),status:(display),patient:(uuid,person:(gender,age)))&totalCount=true&isEnded=false&location=${locationUuid}`,
    (url: string) =>
      openmrsFetch<{
        results: Array<Patient>;
      }>(url).then((res) => res.data.results),
  );

  return {
    patients: data,
    isLoading,
    isError: error,
  };
}
