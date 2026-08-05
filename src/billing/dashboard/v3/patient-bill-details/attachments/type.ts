export interface UploadedFile {
  id: string;
  file: File;
  uploaded?: boolean;
}

export interface GeneratedDocument {
  id: string;
  name: string;
  generated: boolean;
  uploaded?: boolean;
  file?: File;
  url?: string;
}

export type DocumentType = 'DISCHARGE SUMMARY' | 'INVOICE';

export interface DischargeSummary {
  patientName: string;
  age: string;
  ipNumber: string;
  parity: string;
  admissionDate: string;
  deliveryDate: string;
  modeOfDelivery: string;
  babySex: string;
  birthWeight: string;
  fate: string;
  hygieneAdvice: string;
  nutrition: string;
  breastFeeding: string;
  immunization: string;
  familyPlanning: string;
  remarks: string;
  dischargeDate: string;
  clinician: string;
}

export type Attachment = {
  id: string;
  documentType: string;
  title: string;
  files: UploadedFile[];
};

export interface VisitSummaryResponse {
  visit: VisitInfo;
  visitUuids: string[];
  demographics: PatientDemographics;
  allergies: Allergy[];
  conditions: Condition[];
  vitals: PatientVitals;
  medications: Medication[];
  clinicalNotes: ClinicalNote[];
  soapNote: SoapNote;
  labOrders: LabOrder[];
}

export interface VisitInfo {
  uuid: string;
  display: string;
  visitType: string;
  startDatetime: string;
}

export interface PatientDemographics {
  name: string;
  birthDate: string;
  gender: string;
  age: string;
  patientId: string;
  nationalId: string;
  crNumber: string;
}

export interface Allergy {
  // Empty array in your payload, so keep it flexible
  [key: string]: any;
}

export interface Condition {
  code: string;
  description: string;
  certainty: string;
  primary?: boolean;
  onsetDate: string;
}

export interface PatientVitals {
  temperature: string;
  bloodPressure: string;
  pulse: string;
  respiratoryRate: string;
  spo2: string;
  height: string;
  weight: string;
  bmi: string;
  tewScore: string;
}

export interface Medication {
  [key: string]: any;
}

export interface ClinicalNote {
  encounterUuid: string;
  encounterType: string;
  datetime: string;
  fields: ClinicalField[];
}

export interface ClinicalField {
  label: string;
  value: string;
}

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface LabOrder {
  uuid: string;
  test: string;
  orderNumber: string;
  orderedDate: string;
  pending: boolean;
  action: string;
  results: LabResult[];
}

export interface LabResult {
  [key: string]: any;
}
