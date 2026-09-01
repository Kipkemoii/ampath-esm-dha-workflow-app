import { openmrsFetch } from '@openmrs/esm-framework';
import { getEtlBaseUrl, getHieBaseUrl } from '../../shared/utils/get-base-url';

export const fetchEmergencyInterventions = async () => {
  const hieBaseUrl = await getHieBaseUrl();

  const url = `${hieBaseUrl}/emergency/claim/interventions`;
  const response = await openmrsFetch(url);

  const data = await response.json();

  if (!response.ok) {
    const errorText = data.message || 'Failed to fetch Emergency Interventions';
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return data;
};

export async function sendEmergencyClaimIdentified(
  modeOfArrival: string,
  broughtBy: string,
  locationUuid: string,
  interventionCode: string,
  referenceNumber: string,
  beneficiaryCrId: string,
  identificationNumber: string,
  identificationType: string,
  regulationBody: string,
  notes: string,
  otp: string,
): Promise<any> {
  const hieBaseUrl = await getHieBaseUrl();

  const payload = {
    interventionCodes: [interventionCode],
    modeOfArrival: modeOfArrival,
    broughtBy: broughtBy,
    referenceNumber: referenceNumber,
    beneficiaryCrId: beneficiaryCrId,
    identificationNumber: identificationNumber,
    identificationType: identificationType,
    regulationBody: regulationBody,
    notes: notes,
    locationUuid: locationUuid,
    otp: otp,
  };
  const url = `${hieBaseUrl}/emergency/claim/identified`;
  const response = await openmrsFetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorText = data.message || 'Failed to created claim';
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return data;
}

export async function sendEmergencyClaimUnIdentified(
  modeOfArrival: string,
  broughtBy: string,
  locationUuid: string,
  interventionCode: string,
  referenceNumber: string,
  beneficiaryCrId: string,
  identificationNumber: string,
  identificationType: string,
  regulationBody: string,
  notes: string,
): Promise<any> {
  const hieBaseUrl = await getHieBaseUrl();

  const payload = {
    interventionCodes: [interventionCode],
    modeOfArrival: modeOfArrival,
    broughtBy: broughtBy,
    referenceNumber: referenceNumber,
    beneficiaryCrId: beneficiaryCrId,
    identificationNumber: identificationNumber,
    identificationType: identificationType,
    regulationBody: regulationBody,
    notes: notes,
    locationUuid: locationUuid,
  };
  const url = `${hieBaseUrl}/emergency/claim/unidentified`;
  const response = await openmrsFetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorText = data.message || 'Failed to created claim';
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return data;
}

export async function fetchProviders() {
  const etlBaseUrl = await getEtlBaseUrl();
  const url = `${etlBaseUrl}/providers/licensed`;
  const response = await openmrsFetch(url);

  const data = await response.json();

  if (!response.ok) {
    const errorText = data.message || 'Failed to fetch providers';
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  return data;
}
