import { type Location } from '@openmrs/esm-framework';

export type BillableService = {
  uuid: string;
  name: string;
  shortName: string;
  serviceStatus: 'ENABLED' | 'DISABLED';
  serviceType: ServiceType | null;
  servicePrices: ServicePrice[];
  resourceVersion: string;
};

export type ServiceType = {
  display: string;
  resourceVersion: string;
};

export type ServicePrice = {
  uuid: string;
  name: string;
  price: number;
  item: string;
  paymentMode: PaymentMode;
  billableService: BillableService;
  resourceVersion: string;
};

export type PaymentMode = {
  uuid: string;
  name: string;
  description: string | null;
  retired: boolean;
  retireReason: string;
  attributeTypes: unknown[];
  sortOrder: number | null;
  resourceVersion: string;
};

export type PayableBillableService = ServicePrice & {
  billableService: BillableService;
};

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';

export type LineItem = {
  billableService: string;
  quantity: number;
  price: number;
  priceName: string;
  priceUuid: string;
  lineItemOrder: number;
  paymentStatus: PaymentStatus;
};

export type CreateBillDto = {
  lineItems: LineItem[];
  cashPoint: string;
  patient: string;
  status: PaymentStatus;
  payments: any[];
};

export type CashPoint = {
  uuid: string;
  name: string;
  description: string;
  retired: boolean;
  location: Location;
};
