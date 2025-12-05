import { Location, type Patient } from '@openmrs/esm-framework';

export type IdentifierType = 'National ID' | 'Alien ID' | 'Passport' | 'Mandate Number' | 'Refugee ID';

export const IDENTIFIER_TYPES: IdentifierType[] = [
  'National ID',
  'Alien ID',
  'Passport',
  'Mandate Number',
  'Refugee ID',
];

export interface ValidateCustomOtpResponse {
  message: string;
  isValid?: boolean;
}

export type ClientRegistrySearchRequest = {
  identificationNumber: string | number;
  identificationType: string;
  locationUuid: string;
};

export interface RequestCustomOtpResponse {
  message: string;
  sessionId: string;
  maskedPhone: string;
}

export interface ValidateHieCustomOtpDto {
  sessionId: string;
  otp: number | string;
  locationUuid: string;
}

export interface ValidateCustomOtpResponse {
  message: string;
  isValid?: boolean;
}

export type RequestCustomOtpDto = {
  identificationNumber: string | number;
  identificationType: string;
  locationUuid: string;
};

export interface RequestCustomOtpResponse {
  message: string;
  sessionId: string;
  maskedPhone: string;
}

export interface ValidateHieCustomOtpDto {
  sessionId: string;
  otp: number | string;
  locationUuid: string;
}

export enum HieIdentificationType {
  NationalID = 'National ID',
  SHANumber = 'SHA Number',
  HouseholdNumber = 'Household Number',
  RefugeeID = 'Refugee ID',
  AlienID = 'Alien ID',
  MandateNumber = 'Mandate Number',
  Cr = 'id',
  TemporaryDependantID = 'Temporary Dependant ID',
}

export interface HieIdentifications {
  identification_number: string;
  identification_type: HieIdentificationType;
}

export interface HieDependant {
  date_added: string;
  relationship: string;
  total: number;
  result: HieClient[];
}

export interface AlternateContact {
  contact_type: string;
  contact_id: string;
  contact_name: string;
  relationship: string;
  remarks: string;
}

export interface HieClient {
  resourceType: string;
  id: string;
  meta: {
    versionId: string;
    creationTime: string;
    lastUpdated: string;
    source: string;
  };
  originSystem: {
    system: string;
    record_id: string;
  };
  title: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  place_of_birth: string;
  person_with_disability: number;
  citizenship: string;
  kra_pin: string;
  preferred_primary_care_network: string;
  employment_type: string;
  domestic_worker_type: string;
  civil_status: string;
  identification_type: HieIdentificationType;
  identification_number: string;
  other_identifications: HieIdentifications[];
  dependants: HieDependant[];
  is_alive: number;
  deceased_datetime: string;
  phone: string;
  biometrics_verified: number;
  biometrics_score: number;
  email: string;
  country: string;
  county: string;
  sub_county: string;
  ward: string;
  village_estate: string;
  building_house_no: string;
  latitude: string;
  longitude: string;
  province_state_country: string;
  zip_code: string;
  identification_residence: string;
  employer_name: string;
  employer_pin: string;
  disability_category: string;
  disability_subcategory: string;
  disability_cause: string;
  in_lawful_custody: string;
  admission_remand_number: string;
  document_uploads: any[];
  alternative_contacts: AlternateContact[];
  gross_income: number;
  gross_income_currency: string;
  postal_address: string;
  estimated_contribution: number;
  estimated_annual_contribution: number;
  city: string;
  id_serial: string;
  learning_institution_code: string;
  learning_institution_name: string;
  grade_level: string;
  admission_number: string;
  expected_year_of_graduation: string;
  unconfirmed_dependants: HieDependant[];
  is_agent: number;
  agent_id: string;
}

export type PatientSearchResponse = {
  results: Patient[];
  totalCount: number;
};

export type QueuePriority = {
  uuid: string;
  display: string;
};
export type QueueStatus = {
  uuid: string;
  display: string;
};
export type ServiceQueue = {
  uuid: string;
  display: string;
  name: string;
  description: string;
  service: {
    uuid: string;
    display: string;
  };
  allowedPriorities: QueuePriority[];
  allowedStatuses: QueueStatus[];
  location: Location;
};

export type ServiceQueueApiResponse = {
  results: ServiceQueue[];
};

export type QueueEntryDto = {
  visit: {
    uuid: string;
  };
  queueEntry: {
    status: {
      uuid: string;
    };
    priority: {
      uuid: string;
    };
    queue: {
      uuid: string;
    };
    patient: {
      uuid: string;
    };
    startedAt: string;
    sortWeight: number;
  };
};

export type CreateVisitDto = {
  visitType: string;
  location: string;
  startDatetime: null | string;
  stopDatetime: null | string;
  patient: string;
};
