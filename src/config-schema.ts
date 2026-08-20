import { Type, validator } from '@openmrs/esm-framework';

export const configSchema = {
  concepts: {
    defaultPriorityConceptUuid: {
      _type: Type.ConceptUuid,
      _default: false,
      _description: 'The UUID of the default priority for the queues eg Not urgent.',
    },
    defaultStatusConceptUuid: {
      _type: Type.ConceptUuid,
      _default: '51ae5e4d-b72b-4912-bf31-a17efb690aeb',
      _description: 'The UUID of the default status for the queues eg Waiting.',
    },
    defaultTransitionStatus: {
      _type: Type.ConceptUuid,
      _default: 'ca7494ae-437f-4fd0-8aae-b88b9a2ba47d',
      _description: 'The UUID of the default status for attending a service in the queues eg In Service.',
    },
    systolicBloodPressureUuid: {
      _type: Type.ConceptUuid,
      _default: '5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    diastolicBloodPressureUuid: {
      _type: Type.ConceptUuid,
      _default: '5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    emergencyPriorityConceptUuid: {
      _type: Type.ConceptUuid,
      _default: false,
      _description: 'The UUID of the priority with the highest sort weight for the queues eg Emergency.',
    },
    generalPatientNoteConceptUuid: {
      _type: Type.ConceptUuid,
      _default: '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      _description:
        'The UUID of the free text note field intended to capture unstructured description of the patient encounter',
    },
    heightUuid: {
      _type: Type.ConceptUuid,
      _default: '5090AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    historicalObsConceptUuid: {
      _type: Type.Array,
      _default: ['161643AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'],
      _description: 'The Uuids of the obs that are displayed on the previous visit modal',
      _elements: {
        _type: Type.ConceptUuid,
      },
    },
    oxygenSaturationUuid: {
      _type: Type.ConceptUuid,
      _default: '5092AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    pulseUuid: {
      _type: Type.ConceptUuid,
      _default: '5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    problemListConceptUuid: {
      _type: Type.ConceptUuid,
      _default: '1284AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    respiratoryRateUuid: {
      _type: Type.ConceptUuid,
      _default: '5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    temperatureUuid: {
      _type: Type.ConceptUuid,
      _default: '5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    visitDiagnosesConceptUuid: {
      _type: Type.ConceptUuid,
      _default: '159947AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    weightUuid: {
      _type: Type.ConceptUuid,
      _default: '5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    }
  },
  subDomainUrl: {
    _type: Type.String,
    _description: 'Subdomain e.g training,staging',
    _default: '',
  },
  etlBaseUrl: {
    _type: Type.String,
    _description: 'ETL Endpoint',
    _default: '',
  },
  hieBaseUrl: {
    _type: Type.String,
    _description: 'HIE Endpoint',
    _default: '',
  },
  claimsBaseUrl: {
    _type: Type.String,
    _description: '',
    _default: '',
  },
  claimsKey: {
    _type: Type.String,
    _description: '',
    _default: '',
  },
  registrationBillableServices: {
    _type: Type.String,
    _description: 'Billable services e.g consultation',
    _default: '',
  },
  cashConsultationOrderTypeUuid: {
    _type: Type.String,
    _description: 'CASH Consultation Order type uuid',
    _default: '',
  },
  shaConsultationOrderTypeUuid: {
    _type: Type.String,
    _description: 'SHA Consultation Order type uuid',
    _default: '',
  },
  shaInterventionSwitchingUuid: {
    _type: Type.String,
    _description: 'SHA Intervention Switching Order type uuid',
    _default: '',
  },
  cashConsulationConceptUuid: {
    _type: Type.String,
    _description: 'Cash Consultation concept uuid',
    _default: '',
  },
  shaConsulationConceptUuid: {
    _type: Type.String,
    _description: 'SHA Consultation concept uuid',
    _default: '',
  },
  outPatientCareSettingUuid: {
    _type: Type.String,
    _description: 'Outpatient care settings uuid',
    _default: '',
  },
  orderEncounterTypeUuid: {
    _type: Type.String,
    _description: 'Outpatient care settings uuid',
    _default: '',
  },
  nonSHAPaymentModes: {
    _type: Type.Array,
    _description: 'NON SHA payment modes',
    _default: []
  },
  registrationServicequeues: {
    _type: Type.Array,
    _description: 'Service Queues to display at send to triage',
    _default: []
  },
  consultationBillableServiceNames: {
    _type: Type.Array,
    _description: 'Consultation billable service names',
    _default: ["CONSULTATION", "KESSES CONSULTATION"]
  },
  maternityDischargeFormUuid: {
    _type: Type.ConceptUuid,
    _default: 'a6f7d96d-7d6e-3c51-9786-7b817515ff5b'
  },
  maternityDischargeEncounterTypeUuid: {
    _type: Type.ConceptUuid,
    _default: 'e3c2a17f-4d58-4725-b702-a5d75a2231d0'
  },
  shaPaymentModeUuid: {
    _type: Type.ConceptUuid,
    _default: "1be55f87-2931-41e0-89c8-8f5652c7c303"
  },
  shaVariantPaymentModeUuids: {
    _type: Type.Array,
    _default: ["1be55f87-2931-41e0-89c8-8f5652c7c303", "18763f02-16f7-4dfc-aff9-15b53eea20b2", "783ddd3c-52bb-489a-9b39-937eccc6c55c"]
  },
  cashPaymentModeUuid: {
    _type: Type.ConceptUuid,
    _default: "63eff7a4-6f82-43c4-a333-dbcc58fe9f74"
  },
  subBenefitCodesWithHiddenClaimWidget: {
    _type: Type.Array,
    _default: ["SHA-08-SC-02"]
  },
  startClaimVisitLocationAttributeUuid: {
    _type: Type.String,
    _default: "49df844d-79c0-40fc-8ca9-c27d6391f647"
  },
  pmfSchemeNames: {
    _type: Type.Array,
    _default: ["POMSF", "USALAMA", "TSC"]
  },
  /**
   * Which FHIR resource types the SHR record viewer requests and how it labels them.
   *
   * Only the types with shapes confirmed against this HIE/SHR backend are defaulted on.
   * `AllergyIntolerance`, `Immunization` and `DocumentReference` are deliberately absent —
   * there is no evidence the SHR returns them yet. Adding a category later should be a
   * config change only, once the SHR backend owner confirms it is supported.
   */
  shrResourceTypes: {
    _type: Type.Array,
    _description:
      'FHIR resource types to request from the SHR patient-records endpoint, and how ' +
      'to label them as tabs in the viewer. Order controls tab order.',
    _default: [
      { resourceType: 'Condition', label: 'Conditions' },
      { resourceType: 'MedicationRequest', label: 'Medications' },
      { resourceType: 'Encounter', label: 'Encounters' },
      { resourceType: 'Observation', label: 'Lab results' },
      { resourceType: 'ServiceRequest', label: 'Requests' },
      { resourceType: 'Specimen', label: 'Specimens' },
    ],
    _elements: {
      resourceType: {
        _type: Type.String,
        _description: 'FHIR resource type name, spelled exactly as the SHR returns it, e.g. "MedicationRequest".',
      },
      label: {
        _type: Type.String,
        _description: 'Clinician-facing tab label for this resource type, e.g. "Medications".',
      },
    },
  },
  electivePreauth: {
    encounterTypeUuid: {
      _type: Type.UUID,
      _description: 'Preauth encounter type used when saving elective capture obs',
      _default: '18b10189-a89f-430d-83e9-14663fef258c',
    },
    clientRegistryIdentifierTypeUuid: {
      _type: Type.UUID,
      _description: 'Patient identifier type UUID for Client Registry (CR) number',
      _default: 'e88dc246-3614-4ee3-8141-1f2a83054e72',
    },
    encounterRoleUuid: {
      _type: Type.String,
      _description:
        'Encounter role UUID for the session provider on elective preauth encounters (optional; defaults to Clinician/Unknown)',
      _default: '',
    },
    plannedServiceObsConceptUuid: {
      _type: Type.String,
      _description:
        'Text concept UUID that stores the planned orderable (order concept) UUID on elective preauth encounters. Leave empty to use the module default.',
      _default: '',
    },
  },
};

/** One SHR record-viewer category: a FHIR resource type plus its clinician-facing tab label. */
export interface ShrResourceTypeConfig {
  resourceType: string;
  label: string;
}

export type Config = {
  casualGreeting: boolean;
  whoToGreet: Array<string>;
};

export interface ConfigObject {
  // priorityConfigs: Array<PriorityConfig>;
  appointmentStatuses: Array<string>;
  // biometrics: BiometricsConfigObject;
  concepts: {
    defaultPriorityConceptUuid: string;
    defaultStatusConceptUuid: string;
    defaultTransitionStatus: string;
    diastolicBloodPressureUuid: string;
    emergencyPriorityConceptUuid: string;
    generalPatientNoteConceptUuid: string;
    heightUuid: string;
    historicalObsConceptUuid: Array<string>;
    oxygenSaturationUuid: string;
    pulseUuid: string;
    problemListConceptUuid: string;
    respiratoryRateUuid: string;
    systolicBloodPressureUuid: string;
    temperatureUuid: string;
    visitDiagnosesConceptUuid: string;
    weightUuid: string;
  };
  defaultInitialServiceQueue: string;
  contactAttributeType: string;
  customPatientChartUrl: string;
  defaultIdentifierTypes: Array<string>;
  dashboardTitle: {
    key: string;
    value: string;
  };
  // queueTables: TablesConfig;
  showRecommendedVisitTypeTab: boolean;
  visitQueueNumberAttributeUuid: string | null;
  visitTypeResourceUrl: string;
  subDomainUrl: string;
  etlBaseUrl: string;
  hieBaseUrl: string;
  claimsBaseUrl: string;
  claimsKey: string;
  registrationBillableServices: Array<string>;
  cashConsultationOrderTypeUuid: string;
  cashConsulationConceptUuid: string;
  shaConsultationOrderTypeUuid: string;
  shaInterventionSwitchingUuid: string;
  shaConsulationConceptUuid: string;
  outPatientCareSettingUuid: string;
  orderEncounterTypeUuid: string;
  // vitals: VitalsConfigObject;
  nonSHAPaymentModes: Array<string>;
  registrationServicequeues: Array<string>;
  consultationBillableServiceNames: Array<string>;
  maternityDischargeFormUuid: string;
  maternityDischargeEncounterTypeUuid: string;
  shaPaymentModeUuid: string;
  shaVariantPaymentModeUuids: Array<string>;
  cashPaymentModeUuid: string;
  subBenefitCodesWithHiddenClaimWidget: Array<string>;
  startClaimVisitLocationAttributeUuid: string;
  pmfSchemeNames: Array<string>;
  shrResourceTypes: Array<ShrResourceTypeConfig>;
  electivePreauth: {
    encounterTypeUuid: string;
    clientRegistryIdentifierTypeUuid: string;
    encounterRoleUuid: string;
    plannedServiceObsConceptUuid: string;
  };
}

const queueEntryActions = ['move', 'call', 'edit', 'transition', 'signOff', 'remove', 'delete', 'undo'] as const;
export type QueueEntryAction = (typeof queueEntryActions)[number];
