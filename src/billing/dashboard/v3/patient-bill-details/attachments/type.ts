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
  inpatientDetails?: VisitSummaryAdmissionDetails;
  dialysis?: VisitSummaryDialysis;
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
  contact: string;
  clinic: string;
  diagnosis: string;
  address: string;
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

export type VitalReading = {
  label: string;
  value: string;
  unit: string;
  trend: 'up' | 'down' | 'flat';
};

export interface VisitSummaryAdmissionDetails {
  admissionNumber?: string;
  admissionDate?: string;
  dischargeDate?: string | null;
  ward?: string;
  bed?: string;
  room?: string;
  admittingDoctor?: string;
  referringFacility?: string;
  admissionReason?: string;
  status?: 'ADMITTED' | 'DISCHARGED' | 'TRANSFERRED' | 'PENDING' | string;
  diagnosis?: string;
  otherConditions: string;
}
export interface VisitSummaryDialysis {
  facility: VisitSummaryDialysisFacility;
  patient: VisitSummaryDialysisPatient;
  preAssessment: VisitSummaryDialysisPreAssessment;
  prescription: VisitSummaryDialysisPrescription;
  monitoring: VisitSummaryDialysisMonitoringEntry[];
  postAssessment: VisitSummaryDialysisPostAssessment;
  summary: VisitSummaryDialysisSummary;
  signoff: VisitSummaryDialysisSignoff;
  labOrders: LabOrdersData;
}

export interface VisitSummaryDialysisFacility {
  name: string;
  hospital: string;
  address: string;
  phone: string;
  email: string;
}

export interface VisitSummaryDialysisPatient {
  name: string;
  opNo: string;
  insuranceNo: string;
  date: string;
  age: string;
  sex: string;
  contact: string;
  clinic: string;
  diagnosis: string;
  address: string;
}

export interface VisitSummaryDialysisPreAssessment {
  weightBefore: string;
  temperature: string;
  pulse: string;
  bp: string;
  respRate: string;
  oxygenSat: string;
  bloodSugar: string;
  accessType: string;
  accessSite: string;
  doctor: string;
}

export interface VisitSummaryDialysisPrescription {
  dialyzerType: string;
  bfr: string;
  dfr: string;
  duration: string;
  ufGoal: string;
  heparinDose: string;
  dialysateComposition: string;
}

export interface VisitSummaryDialysisMonitoringEntry {
  time: string;
  bp: string;
  pulse: string;
  temp: string;
  ufRemoved: string;
  heparin: string;
  remarks: string;
}

export interface VisitSummaryDialysisPostAssessment {
  weightAfter: string;
  totalUfAchieved: string;
  bp: string;
  pulse: string;
  temperature: string;
  accessSite: string;
  condition: string;
  complications: string;
}

export interface VisitSummaryDialysisSummary {
  prescribedDuration: string;
  actualDuration: string;
  adequacyAchieved: string;
  toleratedProcedure: string;
  comments: string;
  nextSessionDate: string;
  additionalRemarks: string;
}

export interface VisitSummaryDialysisSignoff {
  nurse: VisitSummaryDialysisSignatory;
  doctor: VisitSummaryDialysisSignatory;
}

export interface VisitSummaryDialysisSignatory {
  name: string;
  regNo: string;
  date: string;
}

export interface LabResult {
  test: string;
  value: string;
  units?: string;
  datetime: string;
  range?: string;
}

export interface LabOrder {
  uuid: string;
  test: string;
  orderNumber: string;
  orderedDate: string;
  action: string;
  pending: boolean;
  fulfillerStatus?: string;
  results: LabResult[];
}

interface LabOrdersData {
  labOrders: LabOrder[];
}
