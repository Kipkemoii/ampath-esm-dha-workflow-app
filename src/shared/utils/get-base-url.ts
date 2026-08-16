import { getConfig } from '@openmrs/esm-framework';
import { moduleName } from '../..';

export async function getSubDomainUrl() {
  const { subDomainUrl } = await getConfig(moduleName);
  return subDomainUrl ?? null;
}

export async function getEtlBaseUrl() {
  const { etlBaseUrl } = await getConfig(moduleName);
  return etlBaseUrl ?? null;
}

export async function getHieBaseUrl() {
  const { hieBaseUrl } = await getConfig(moduleName);
  return hieBaseUrl ?? null;
}

export async function getClaimsUrl() {
  const { claimsBaseUrl } = await getConfig(moduleName);
  return claimsBaseUrl ?? null;
}

export async function getClaimsKey() {
  const { claimsKey } = await getConfig(moduleName);
  return claimsKey ?? null;
}

export async function getCashPaymentModeUuid() {
  const { cashPaymentModeUuid } = await getConfig(moduleName);
  return cashPaymentModeUuid ?? null;
}
