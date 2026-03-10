import { type HieBillPayment } from '../types';
import { getHieBaseUrl } from '../utils/get-base-url';

export async function createClientPayment(createClientBillPaymentDto: HieBillPayment): Promise<HieBillPayment> {
  const hieBaseUrl = await getHieBaseUrl();
  const url = `${hieBaseUrl}/payment`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createClientBillPaymentDto),
  });

  const data = response.json();
  return data;
}
