import { type CashPoint, type BillableService, type LineItem } from '../../shared/types';

export interface ApiLink {
  rel: string;
  uri: string;
  resourceAlias: string;
}

export interface Cashier {
  uuid: string;
  display: string;
  links: ApiLink[];
}

export interface Patient {
  uuid: string;
  display: string;
  voided: boolean;
  links: ApiLink[];
}

export type PaymentStatus = 'PENDING' | 'PAID' | 'CANCELLED' | string;
export type BillStatus = 'PENDING' | 'PAID' | 'CANCELLED' | string;

export type Payment = {
  uuid: string;
  instanceType: {
    uuid: string;
    name: string;
    description: string | null;
    retired: boolean;
  };
  attributes: any[];
  amount: number;
  amountTendered: number;
  dateCreated: number;
  voided: boolean;
  resourceVersion: string;
};

export interface Bill {
  uuid: string;
  receiptNumber: string;
  status: BillStatus;
  adjustmentReason: string | null;
  adjustedBy: any[];
  billAdjusted: string | null;
  cashPoint: CashPoint;
  cashier: Cashier;
  dateCreated: string;
  lineItems: LineItem[];
  patient: Patient;
  payments: Payment[];
  resourceVersion: string;
}

export type PayBillDto = {
  instanceType: string;
  amountTendered: number;
  amount: number;
};
export type EditLineItem = {
  uuid: string;
  display: string;
  voided: boolean;
  voidReason: string | null;
  item: '';
  billableService: string;
  quantity: number;
  price: number;
  priceName: string;
  priceUuid: string;
  lineItemOrder: 0;
  status: PaymentStatus;
  resourceVersion: string;
};
export type EditBillLineItemDto = {
  cashPoint: string;
  cashier: string;
  lineItems: EditLineItem[];
  patient: string;
  status: BillStatus;
  uuid: string;
};

export type AmrsVisitDiagnosis = {
  patient_id: number;
  encounter_id: number;
  encounter_datetime: string;
  facility: string;
  encounter_type: string;
  concept_id?: number | null;
  value_coded?: number | null;
  /** Encounter diagnosis coded concept (/patient/encounter-diagnosis). */
  diagnosis_coded?: number | null;
  /**
   * Diagnosis rank from encounter-diagnosis ETL (1 = primary / preferred for preauth).
   * Lower ranks are preferred when multiple diagnoses are present.
   */
  dx_rank?: number | null;
  concept_source_name: string;
  hl7_code: string;
  icd11_code: string;
  provider_id: string | number;
  national_id: string;
  speciality?: string | null;
  uuid: string;
  practioner_nat_id: string;
  practitioner_speciality: string;
  practitioner_identifier_type: string;
  practitioner_body: string;
};

export type AmrsVisitDiagnosisDto = {
  visitDate: string;
  patientUuid: string;
  locationUuid: string;
};
export type AmrsVisitDiagnosisResponse = {
  results: AmrsVisitDiagnosis[];
};

export type AmrsMaternityDiagnosis = {
  uuid: string;
  encounter_id: number;
  encounter_datetime: string;
  encounter_type: string;
  icd11_code: string;
  hl7_code: string;
  concept_source_name: string;
  practioner_nat_id: string;
  practitioner_speciality: string;
  practitioner_body: string;
  practitioner_identifier_type: string;
  patient_id: string;
  facility: string;
  concept_id: string;
  value_coded: string;
};

export type AmrsMaternityDiagnosisDto = {
  billingDate: string;
  patientUuid: string;
};
export type AmrsMaternityDiagnosisResponse = {
  results: AmrsMaternityDiagnosis[];
};

export interface FacilityPreauth {
  cash_point: string;
  bill_date: string;
  patient_name: string;
  patient_uuid: string;
  status: string;
  cr_no: string;
  amrs_universal_id: string;
  intervention_code: string;
  consent_token: string | null;
  order_no: string;
  service_type: string;
  requires_preauth: number;
  normal_preauth: number;
  elective_preauth: number;
  preauth_approved: number;
  required_documents: string | null;
  applicable_document_types: string;
  required_preauth_document_types: string;
}

export interface FacilityPreauthsResponse {
  results: FacilityPreauth[];
}

export type BedOccupancyRate = {
  total_ip_visits: number;
  icu_visits: number;
  hdu_visits: number;
  normal_ip_visits: number;
  newborn_visits: number;
  dialysis_visits: number;
  total_number_of_bed: number;
  number_of_normal_bed: number;
  number_of_icu_bed: number;
  number_of_hdu_bed: number;
  number_of_dialysis_bed: number;
  number_of_baby_cot: number;
}

export type BedOccupancy = {
  name: string;
  bp_level: string;
  bed_occupancy_rate: BedOccupancyRate
};
export interface PayerPreviewResponse {
  results: PayerPreviewResult[];
}
export interface PayerPreviewResult {
  id: number;
  guid: string;
  authorization: PayerAuthorization;
  billFrom: string;
  billTo: string;
  created: string;
  workflowState: string;
  workflowDisplayName: string;
  claimType: string;
  actualDeductableCopay: string;
  proposedValue: string;
  proposedValueLessCopays: string;
  totalCopayValue: string;
  trackingNumber: string;
  authToken: string;
  memberNumber: string;
  memberName: string;
  providerName: string;
  encounter: number;
  providerClaimNo: string;
  isInpatient: boolean;
  diagnoses: PayerDiagnosis[];
  claimLines: PayerClaimLine[];
  claimTransitions: PayerClaimTransition[];
  claimNotes: PayerClaimNote[];
  claimDoctors: PayerClaimDoctor[];
  owner: number;
  schemeName: string;
}
interface PayerAuthorization {
  id: number;
  guid: string;
  createdByName: string;
  providerName: string;
  authCode: string;
  beneficiaryName: string;
  beneficiaryCode: string;
  beneficiaryScheme: string;
  beneficiaryJoinDate: string;
  interventions: PayerIntervention[];
  token: string;
  status: string;
  expiry: string;
  notes: string;
  benefitType: string;
  created: string;
  isOpen: boolean;
  isComplete: boolean;
  label: string;
  authorizationType: string[];
  beneficiaryNumber: string;
  preauthIds: number[];
  totalAuthorizedAmount: string;
  currentAvailableBalance: string;
  needsPreauth: boolean;
  isElective: boolean;
  overallPreauthFinalised: boolean;
  owner: number;
}
export interface PayerIntervention {
  id: number;
  guid: string;
  accessPoint: string;
  name: string;
  code: string;
  status: string;
  paymentMechanism: string;
  coverageLevel: string;
  applicableGender: string;
  applicableFacilityOwnership: string;
  usageFrequencyType: string;
  levelsApplicable: string[] | null;
  annualQuantityLimit: number;
  active: boolean;
  needsPreauth: boolean;
  needsManualPreauthApproval: boolean;
  needsDoctorAuthorization: boolean;
  needsMemberAuthorization: boolean;
  needApprovalBeforeClaimSubmission: boolean;
  isIntraMetro: boolean;
  managementTariffHasLimit: boolean;
  investigationTariffHasLimit: boolean;
  overallTariff: string;
  overallTariffHasLimit: boolean;
  benefit: number;
  kephLevelTarrif: string;
  preauthFinalised: boolean;
  requiresSurgicalPreauth: boolean;
  requiresRenalPreauth: boolean;
  requiresOncologyPreauth: boolean;
  requiresRadiologyPreauth: boolean;
  requiresOpticalPreauth: boolean;
  optionalDocumentType: string | null;
  requiredPreauthDocumentTypes: string[] | null;
  optionalPreauthDocumentTypes: string[] | null;
  applicableDocumentTypes: string[];
}
export interface PayerDiagnosis {
  guid: string;
  encounterGuid: string;
  encounter: number;
  siteCode: string;
  siteCodeType: string;
  name: string;
  intervention: number;
}
export interface PayerClaimLine {
  id: number;
  guid: string;
  name: string;
  quantity: string;
  intervention: number;
  interventionCode: string;
  interventionName: string;
  billFrom: string;
  billTo: string;
  unit: string;
  unitPrice: string;
  claimLineTotal: string;
  claimLineGrossTotal: string;
  approvedLineTotal: string;
  rejectedLineTotal: string;
  providerClaimLineNo: string;
  billingCode: string;
  chargeDate: string;
  workflowState: string;
  schemeCode: string;
  schemeName: string;
}
export interface PayerClaimTransition {
  id: number;
  guid: string;
  workflowStateFrom: string;
  workflowStateTo: string;
  transitionDate: string;
}
export interface PayerClaimNote {
  id: number;
  guid: string;
  note: string;
  author: string;
  source: string;
  workflowState: string;
}
export interface PayerClaimDoctor {
  name: string;
  doctorProfile: DoctorProfile;
}
interface DoctorProfile {
  practitionerRegistryId: string;
  practitionerCadre: string;
  practitionerLicenseBody: string;
  practitionerRegistrationNumber: string;
  practitionerLicenceNumber: string;
  practitionerLicenceValidity: string; // date
  practitionerQualifications: string;
}

export type ClaimVisit = {
  id: number;
  locationUuid: string;
  patientId: string;
  serviceType: string;
  claimVisitId: string;
  claimVisitNumber: string;
  visitStart: string;
  authorizationCode: string;
  providerStatus: string;
  providerAuthStatus: string;
  payerStatus: string;
  payerAuthStatus: string;
  totalClaimAmount: string;
  totalClaimNetAmount: string;
  totalClaimCoPay: string;
  totalClaimDiscount: string;
  authorizationGuid: string;
  invoiceNo: string;
  dateCreated: Date;
}

export type FetchClaimVisitDto = {
  consentToken?: string;
  locationUuid?: string;
  visitDate?: string;
  patientId?: string;
  providerStatus?: string;
  providerAuthStatus?: string;
  payerStatus?: string;
  payerAuthStatus?: string;
}