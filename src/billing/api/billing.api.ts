import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { getClaimsUrl, getClaimsKey } from '../../shared/utils/get-base-url';

async function claimsFetch(path: string, method: string = 'GET', body?: any) {
  try {
    const [baseUrl, claimsKey] = await Promise.all([getClaimsUrl(), getClaimsKey()]);
    const url = 'https://kibana.ampath.or.ke/etl-claims/api/hie';

    const res = await openmrsFetch(`${url}${path}`, {
      method,
      headers: {
        'AMPATH-CLAIMS-KEY': claimsKey,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    return res?.data;
  } catch (error: any) {
    return {
      success: false,
      data: null,
      message: error?.response?.data?.message || error?.message || 'Claims API request failed',
    };
  }
}

export async function raiseSHAClaim(billId: string) {
  if (!billId) {
    return {
      success: false,
      data: null,
      message: 'Bill ID is required to raise a SHA claim',
    };
  }

  return claimsFetch(`/claims/${billId}`, 'POST');
}

export async function UpdateBillItemStatus(payload: any) {
  return claimsFetch(`/bill-item/status`, 'POST', payload);
}

export async function fetchBillsByDate(billDate: string) {
  if (!billDate) {
    return {
      success: false,
      data: null,
      message: 'Bill date is required',
    };
  }

  return claimsFetch(`/daily-bills?locationUuId=090089ea-1352-11df-a1f1-0026b9348838&billDate=${billDate}`);
}

export async function checkClaimStatus(billUuid: string) {
  if (!billUuid) {
    return {
      success: false,
      data: null,
      message: 'Bill UUID is required',
    };
  }

  return claimsFetch(`/claims/${billUuid}/status`);
}

export async function updateBillStatus(billUuid: string) {
  if (!billUuid) {
    return {
      success: false,
      data: null,
      message: 'Bill UUID is required',
    };
  }

  return claimsFetch(`/bills/${billUuid}/status`);
}

export async function fetchBillById(billId: string) {
  const res = await openmrsFetch(`${restBaseUrl}/billing/bill/${billId}`);
  return res.data;
}

export async function fetchPaymentModes() {
  const res = await openmrsFetch(`${restBaseUrl}/billing/paymentMode`);
  return res.data;
}

export async function finalizeBill(billUuid: string) {
  if (!billUuid) {
    return {
      success: false,
      data: null,
      message: 'Bill UUID is required',
    };
  }

  return claimsFetch(`/bills/${billUuid}/status`, 'POST');
}

export async function processPayment(billId: string, payload: any) {
  return openmrsFetch(`${restBaseUrl}/billing/bill/${billId}/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
}

export async function updateBillItemStatus(
  billUuid: string,
  billItemUuid: string,
  cashModeUuid: string = '63eff7a4-6f82-43c4-a333-dbcc58fe9f74',
) {
  if (!billUuid) {
    return {
      success: false,
      data: null,
      message: 'Bill UUID is required',
    };
  }

  if (!billItemUuid) {
    return {
      success: false,
      data: null,
      message: 'Bill Item UUID is required',
    };
  }

  const payload = {
    billUuid: billUuid,
    billItemsUuid: [billItemUuid],
    cashModeUuid: '63eff7a4-6f82-43c4-a333-dbcc58fe9f74',
  };

  const res = claimsFetch(`/bill-item/status`, 'POST', payload);

  return res;
}
