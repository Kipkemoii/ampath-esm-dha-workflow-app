import { type HieClientPaymentMode, type CreateClientPaymentModeDto } from '../types';
import { getHieBaseUrl } from '../utils/get-base-url';

export async function createClientPaymentMode(
  createClientPaymentModeDto: CreateClientPaymentModeDto,
): Promise<HieClientPaymentMode> {
  const hieBaseUrl = await getHieBaseUrl();
  const url = `${hieBaseUrl}/client-payment-mode`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createClientPaymentModeDto),
  });

  const data = response.json();
  return data;
}

export async function fetchClientPaymentMode(clientId: string): Promise<HieClientPaymentMode> {
  const hieBaseUrl = await getHieBaseUrl();
  const url = `${hieBaseUrl}/client-payment-mode?clientId=${clientId}`;
  const response = await fetch(url);
  const data = response.json();
  return data;
}
