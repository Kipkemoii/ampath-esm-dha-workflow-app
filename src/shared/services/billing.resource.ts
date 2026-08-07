import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type CreateBillDto, type BillableService, type PaymentMode, type CashPoint } from '../types';
import { getHieBaseUrl } from '../utils/get-base-url';
import { postJson } from '../../registry/registry.resource';
import dayjs from 'dayjs';

export async function fetchPaymentModes(): Promise<PaymentMode[]> {
  const paymentModeUrl = `${restBaseUrl}/billing/paymentMode`;
  const resp = await openmrsFetch(paymentModeUrl);
  const data = await resp.json();
  return data.results ?? [];
}

export async function fetchBillableServices(): Promise<BillableService[]> {
  const v = 'full';
  const billableServiceUrl = `${restBaseUrl}/billing/billableService`;
  const resp = await openmrsFetch(`${billableServiceUrl}?v=${v}`);
  const data = await resp.json();
  return data.results ?? [];
}

export async function createBill(createBillDto: CreateBillDto) {
  const createBillUrl = `${restBaseUrl}/billing/bill`;
  const response = await openmrsFetch(createBillUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(createBillDto),
  });
  return response.data;
}

type PendingPatientBill = {
  uuid: string;
  dateCreated: string;
  lineItems: any[];
};

export async function fetchCurrentDayPendingPatientBills(patientUuid: string): Promise<PendingPatientBill[]> {
  const v = 'custom:(uuid,lineItems,cashPoint,dateCreated)';
  const billUrl = `${restBaseUrl}/billing/bill?patientUuid=${patientUuid}&status=PENDING&v=${v}`;
  const resp = await openmrsFetch(billUrl);
  const data = await resp.json();
  const results = data?.results ?? [];
  const today = dayjs().startOf('day');

  return results.filter((bill) => dayjs(bill?.dateCreated).startOf('day').isSame(today));
}

export async function updateBill(billUuid: string, payload: { lineItems: any[] }) {
  const updateBillUrl = `${restBaseUrl}/billing/bill/${billUuid}`;
  const response = await openmrsFetch(updateBillUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function fetchCashPoints(): Promise<CashPoint[]> {
  const v = 'full';
  const cashPointUrl = `${restBaseUrl}/billing/cashPoint?v=${v}`;
  const resp = await openmrsFetch(cashPointUrl);
  const data = await resp.json();
  return data.results ?? [];
}

export const createOrderBillInHie = async (payload) => {
    const hieBaseUrl = await getHieBaseUrl();
    const url = `${hieBaseUrl}/bill-order`;
    return postJson<{ bill_uuid: string }>(url, payload);
}
