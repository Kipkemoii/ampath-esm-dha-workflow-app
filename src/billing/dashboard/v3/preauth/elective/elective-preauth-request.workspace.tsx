import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  ButtonSet,
  Checkbox,
  ComboBox,
  DatePicker,
  DatePickerInput,
  Dropdown,
  Form,
  InlineLoading,
  InlineNotification,
  Tag,
  TextArea,
  TextInput,
} from '@carbon/react';
import { showSnackbar, useConfig, useSession, Workspace2 } from '@openmrs/esm-framework';
import type { Workspace2DefinitionProps } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import type { ConfigObject } from '../../../../../config-schema';
import type { Intervention } from '../../../../../claims/index';
import {
  preauthFormLabel,
  readSpecialtyFlags,
} from '../preauth.resource';
import {
  createElectivePreauthEncounter,
  extractShaCodeFromConcept,
  fetchPatientCrNumber,
  fetchTodaysVisitDiagnoses,
  holdElectivePreauthRequest,
  loadElectiveEncounterForEdit,
  resolveCoverageForConcept,
  searchElectiveConcepts,
  searchElectiveDiagnoses,
  syncElectiveHoldOrderConcept,
  updateElectivePreauthEncounter,
  type ElectiveConceptOption,
  type ElectiveDiagnosisOption,
  type ElectiveEncounterObsProps,
} from './elective-preauth.resource';
import styles from './elective-preauth-request.workspace.scss';

interface ElectivePreauthRequestWorkspaceProps {
  patientUuid?: string;
  /** When set, workspace edits this encounter (void-and-replace obs). */
  encounterUuid?: string;
  holdId?: number;
  onSuccess?: () => void;
}

interface PatientChartGroupProps {
  patientUuid?: string;
}

const ANAESTHESIA = ['GENERAL', 'LOCAL', 'SPINAL', 'SEDATION'];
const FREQUENCY = ['TWICE_A_WEEK', 'ONCE_A_WEEK', 'ONCE_EVERY_2_WEEKS', 'ONCE_EVERY_3_WEEKS', 'ONCE_A_MONTH'];
const STAGING = ['STAGE_1', 'STAGE_2', 'STAGE_3', 'STAGE_4'];
const METASTASES = ['LUNG', 'BRAIN', 'LIVER', 'OTHER'];
const TREATMENT = ['DAY_WARD', 'RECLINING_CHAIR', 'SIDE_ROOM'];
const LENS = ['FRAMES_LENSES', 'FRAMED', 'CONTACT'];
const NEW_OR_REPL = ['NEW', 'REPLACEMENT'];

const ElectivePreauthRequestWorkspace: React.FC<
  Workspace2DefinitionProps<ElectivePreauthRequestWorkspaceProps, object, PatientChartGroupProps>
> = ({ closeWorkspace, workspaceProps, groupProps }) => {
  const session = useSession();
  const config = useConfig<ConfigObject>();
  const electiveCfg = config.electivePreauth;
  const locationUuid = session?.sessionLocation?.uuid ?? '';
  const patientUuid = workspaceProps?.patientUuid ?? groupProps?.patientUuid ?? '';
  const providerUuid = session?.currentProvider?.uuid ?? '';
  const editEncounterUuid = (workspaceProps?.encounterUuid ?? '').trim();
  const isEdit = Boolean(editEncounterUuid);
  const plannedServiceObsConceptUuid = electiveCfg?.plannedServiceObsConceptUuid ?? '';

  const [concepts, setConcepts] = useState<ElectiveConceptOption[]>([]);
  const [loadingConcepts, setLoadingConcepts] = useState(false);
  const [selected, setSelected] = useState<ElectiveConceptOption | null>(null);
  const [resolvedShaCode, setResolvedShaCode] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<Intervention | null>(null);
  const [loadingCoverage, setLoadingCoverage] = useState(false);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);
  const [existingObs, setExistingObs] = useState<ElectiveEncounterObsProps[]>([]);
  const [editHoldId, setEditHoldId] = useState<number | null>(workspaceProps?.holdId ?? null);
  const [editHoldOrderNo, setEditHoldOrderNo] = useState<string | null>(null);

  const [clinicalIndications, setClinicalIndications] = useState('');
  const [expectedDate, setExpectedDate] = useState<Date | null>(null);

  // Diagnosis — visible field; prefilled from today's visit when available
  const [diagnosis, setDiagnosis] = useState<ElectiveDiagnosisOption | null>(null);
  const [visitDiagnoses, setVisitDiagnoses] = useState<ElectiveDiagnosisOption[]>([]);
  const [diagnosisItems, setDiagnosisItems] = useState<ElectiveDiagnosisOption[]>([]);
  const [loadingDiagnoses, setLoadingDiagnoses] = useState(false);
  const [searchingDiagnoses, setSearchingDiagnoses] = useState(false);
  const [diagnosisPrefillNote, setDiagnosisPrefillNote] = useState<string | null>(null);

  // Surgical
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [vitalSigns, setVitalSigns] = useState('');
  const [hpi, setHpi] = useState('');
  const [physicalExam, setPhysicalExam] = useState('');
  const [investigations, setInvestigations] = useState('');
  const [anaesthesia, setAnaesthesia] = useState('');
  const [surgeryDate, setSurgeryDate] = useState<Date | null>(null);
  const [relatedToEmployment, setRelatedToEmployment] = useState(false);
  const [relatedToAccident, setRelatedToAccident] = useState(false);
  const [isCoInsured, setIsCoInsured] = useState(false);
  const [coInsuranceDetails, setCoInsuranceDetails] = useState('');

  // Renal / oncology shared
  const [sessionsRequired, setSessionsRequired] = useState('');
  const [costPerSession, setCostPerSession] = useState('');
  const [frequency, setFrequency] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);

  // Optical
  const [necessity, setNecessity] = useState('');
  const [lensPrescription, setLensPrescription] = useState('');
  const [newOrReplacement, setNewOrReplacement] = useState('');
  const [lensAmount, setLensAmount] = useState('');
  const [eyeExamAmount, setEyeExamAmount] = useState('');
  const [frameAmount, setFrameAmount] = useState('');

  // Oncology (shown to match Raise; free-text details fold into clinical indications on save)
  const [carcinomaStaging, setCarcinomaStaging] = useState('');
  const [metastases, setMetastases] = useState('');
  const [treatmentSetting, setTreatmentSetting] = useState('');
  const [comorbidity, setComorbidity] = useState('');
  const [progressReport, setProgressReport] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const searchSeq = useRef(0);
  const diagnosisSearchSeq = useRef(0);

  const specialty = useMemo(() => readSpecialtyFlags(coverage), [coverage]);
  const specialtyLabel = useMemo(() => preauthFormLabel(specialty), [specialty]);

  // Match Raise: clinical indications shown for renal, optical, imaging; elective also always
  // requires them in formRelevant — show a top-level field when surgical-only or oncology-only.
  const showSharedClinicalIndications =
    specialty.requiresRenalPreauth ||
    specialty.requiresOpticalPreauth ||
    specialty.requiresRadiologyPreauth ||
    specialty.requiresOncologyPreauth ||
    (!specialty.requiresSurgicalPreauth &&
      !specialty.requiresRenalPreauth &&
      !specialty.requiresOpticalPreauth &&
      !specialty.requiresRadiologyPreauth &&
      !specialty.requiresOncologyPreauth);

  // Elective Raise always requires clinicalIndications — for surgical-only, show it above surgical.
  const showElectiveClinicalIndications =
    specialty.requiresSurgicalPreauth || showSharedClinicalIndications;

  useEffect(() => {
    if (!patientUuid || !locationUuid) {
      setVisitDiagnoses([]);
      setDiagnosisItems([]);
      setDiagnosis(null);
      setDiagnosisPrefillNote(null);
      return;
    }

    let cancelled = false;
    setLoadingDiagnoses(true);
    setDiagnosisPrefillNote(null);
    void fetchTodaysVisitDiagnoses(patientUuid, locationUuid)
      .then(({ options, preferred }) => {
        if (cancelled) return;
        setVisitDiagnoses(options);
        if (preferred?.conceptUuid) {
          const matched =
            options.find((o) => o.conceptUuid === preferred.conceptUuid) ?? preferred;
          const items =
            matched === preferred && !options.some((o) => o.conceptUuid === preferred.conceptUuid)
              ? [matched, ...options]
              : options;
          setDiagnosisItems(items);
          setDiagnosis(matched);
          setDiagnosisPrefillNote('Prefilled from today’s visit diagnosis.');
        } else if (options.length > 0) {
          setDiagnosisItems(options);
          setDiagnosisPrefillNote('Select a diagnosis from today’s visit, or search the dictionary.');
        } else {
          setDiagnosisItems([]);
          setDiagnosisPrefillNote('No diagnosis on today’s visit — search the dictionary to add one.');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setVisitDiagnoses([]);
        setDiagnosisItems([]);
        setDiagnosisPrefillNote('Could not load today’s diagnoses — search the dictionary to add one.');
      })
      .finally(() => {
        if (!cancelled) setLoadingDiagnoses(false);
      });

    return () => {
      cancelled = true;
    };
  }, [patientUuid, locationUuid]);

  // Prefill when editing an existing elective encounter.
  useEffect(() => {
    if (!isEdit || !editEncounterUuid || !patientUuid) {
      setLoadingEdit(false);
      return;
    }

    let cancelled = false;
    setLoadingEdit(true);
    void (async () => {
      try {
        const model = await loadElectiveEncounterForEdit(
          editEncounterUuid,
          patientUuid,
          plannedServiceObsConceptUuid,
        );
        if (cancelled) return;

        setExistingObs(model.existingObs);
        if (model.hold?.id) {
          setEditHoldId(model.hold.id);
          setEditHoldOrderNo(model.hold.orderNo ?? null);
        }
        if (model.diagnoses[0]) {
          setDiagnosis(model.diagnoses[0]);
          setDiagnosisItems((prev) => {
            const merged = [model.diagnoses[0], ...prev.filter((d) => d.conceptUuid !== model.diagnoses[0].conceptUuid)];
            return merged;
          });
          setDiagnosisPrefillNote('Loaded from elective encounter diagnosis.');
        }

        if (model.plannedConcept) {
          setSelected(model.plannedConcept);
          setCoverage(null);
          setCoverageError(null);
          setResolvedShaCode(null);
          const shaCode = extractShaCodeFromConcept(model.plannedConcept);
          if (!shaCode) {
            setCoverageError(`No SHA mapping found for “${model.plannedConcept.display}”.`);
          } else {
            setResolvedShaCode(shaCode);
            setLoadingCoverage(true);
            try {
              const cr = await fetchPatientCrNumber(
                patientUuid,
                electiveCfg?.clientRegistryIdentifierTypeUuid ?? '',
              );
              if (!cr) {
                setCoverageError('Patient needs a Client Registry identifier to check SHA coverage.');
              } else {
                const intervention = await resolveCoverageForConcept(cr, locationUuid, shaCode);
                if (!intervention) {
                  setCoverageError(`No SHA coverage found for ${shaCode}.`);
                } else {
                  setCoverage(intervention);
                  if (!intervention.needsManualPreauthApproval) {
                    setCoverageError(
                      `${shaCode} does not require elective (manual) preauth. Capture fields are hidden.`,
                    );
                  }
                }
              }
            } catch (err) {
              setCoverageError(err instanceof Error ? err.message : 'Coverage lookup failed');
            } finally {
              setLoadingCoverage(false);
            }
          }
        }

        // Apply form values after concept/coverage so reset does not wipe them.
        const fv = model.formValues;
        if (fv.clinicalIndications) setClinicalIndications(fv.clinicalIndications);
        if (fv.expectedServiceStartDate) {
          const d = dayjs(fv.expectedServiceStartDate);
          if (d.isValid()) setExpectedDate(d.toDate());
        } else if (fv.startDate) {
          const d = dayjs(fv.startDate);
          if (d.isValid()) setExpectedDate(d.toDate());
        }
        if (fv.chiefComplaint) setChiefComplaint(fv.chiefComplaint);
        if (fv.hpi) setHpi(fv.hpi);
        if (fv.physicalExam) setPhysicalExam(fv.physicalExam);
        if (fv.investigations) setInvestigations(fv.investigations);
        if (fv.anaesthesia) setAnaesthesia(fv.anaesthesia);
        if (fv.surgeryDate) {
          const d = dayjs(fv.surgeryDate);
          if (d.isValid()) setSurgeryDate(d.toDate());
        }
        if (fv.relatedToEmployment != null) setRelatedToEmployment(fv.relatedToEmployment);
        if (fv.relatedToAccident != null) setRelatedToAccident(fv.relatedToAccident);
        if (fv.isCoInsured != null) setIsCoInsured(fv.isCoInsured);
        if (fv.coInsuranceDetails) setCoInsuranceDetails(fv.coInsuranceDetails);
        if (fv.sessionsRequired) setSessionsRequired(fv.sessionsRequired);
        if (fv.frequency) setFrequency(fv.frequency);
        if (fv.startDate) {
          const d = dayjs(fv.startDate);
          if (d.isValid()) setStartDate(d.toDate());
        }
      } catch (e) {
        if (!cancelled) {
          setCoverageError(e instanceof Error ? e.message : 'Failed to load encounter for edit');
        }
      } finally {
        if (!cancelled) setLoadingEdit(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, editEncounterUuid, patientUuid, plannedServiceObsConceptUuid, locationUuid]);

  const resetCaptureFields = () => {
    setClinicalIndications('');
    setExpectedDate(null);
    setChiefComplaint('');
    setVitalSigns('');
    setHpi('');
    setPhysicalExam('');
    setInvestigations('');
    setAnaesthesia('');
    setSurgeryDate(null);
    setRelatedToEmployment(false);
    setRelatedToAccident(false);
    setIsCoInsured(false);
    setCoInsuranceDetails('');
    setSessionsRequired('');
    setCostPerSession('');
    setFrequency('');
    setStartDate(null);
    setNecessity('');
    setLensPrescription('');
    setNewOrReplacement('');
    setLensAmount('');
    setEyeExamAmount('');
    setFrameAmount('');
    setCarcinomaStaging('');
    setMetastases('');
    setTreatmentSetting('');
    setComorbidity('');
    setProgressReport('');
  };

  const isDirty = Boolean(
    selected ||
      diagnosis ||
      clinicalIndications.trim() ||
      chiefComplaint.trim() ||
      vitalSigns.trim() ||
      hpi.trim() ||
      physicalExam.trim() ||
      investigations.trim() ||
      anaesthesia ||
      surgeryDate ||
      sessionsRequired.trim() ||
      costPerSession.trim() ||
      frequency ||
      startDate ||
      necessity.trim() ||
      lensPrescription ||
      newOrReplacement ||
      lensAmount.trim() ||
      eyeExamAmount.trim() ||
      frameAmount.trim() ||
      carcinomaStaging ||
      metastases ||
      treatmentSetting ||
      comorbidity.trim() ||
      progressReport.trim() ||
      expectedDate,
  );

  const onConceptInputChange = useCallback((inputValue: string) => {
    const q = (inputValue ?? '').trim();
    const seq = ++searchSeq.current;
    if (q.length < 2) {
      setConcepts([]);
      setLoadingConcepts(false);
      return;
    }
    setLoadingConcepts(true);
    void searchElectiveConcepts(q)
      .then((list) => {
        if (seq !== searchSeq.current) return;
        setConcepts(list);
      })
      .catch(() => {
        if (seq !== searchSeq.current) return;
        setConcepts([]);
      })
      .finally(() => {
        if (seq !== searchSeq.current) return;
        setLoadingConcepts(false);
      });
  }, []);

  const onDiagnosisInputChange = useCallback(
    (inputValue: string) => {
      const q = (inputValue ?? '').trim();
      const seq = ++diagnosisSearchSeq.current;
      if (q.length < 2) {
        setDiagnosisItems(visitDiagnoses);
        setSearchingDiagnoses(false);
        return;
      }
      setSearchingDiagnoses(true);
      void searchElectiveDiagnoses(q)
        .then((list) => {
          if (seq !== diagnosisSearchSeq.current) return;
          // Prefer visit hits first when they still match the query text.
          const qLower = q.toLowerCase();
          const fromVisit = visitDiagnoses.filter(
            (d) =>
              d.display.toLowerCase().includes(qLower) ||
              d.icd11Code.toLowerCase().includes(qLower),
          );
          const seen = new Set(fromVisit.map((d) => d.conceptUuid));
          const merged = [...fromVisit, ...list.filter((d) => d.conceptUuid && !seen.has(d.conceptUuid))];
          setDiagnosisItems(merged);
        })
        .catch(() => {
          if (seq !== diagnosisSearchSeq.current) return;
          setDiagnosisItems(visitDiagnoses);
        })
        .finally(() => {
          if (seq !== diagnosisSearchSeq.current) return;
          setSearchingDiagnoses(false);
        });
    },
    [visitDiagnoses],
  );

  const onSelectConcept = async (item: ElectiveConceptOption | null) => {
    setSelected(item);
    setCoverage(null);
    setCoverageError(null);
    setResolvedShaCode(null);
    resetCaptureFields();
    if (!item || !patientUuid || !locationUuid) return;

    const shaCode = extractShaCodeFromConcept(item);
    if (!shaCode) {
      setCoverageError(`No SHA mapping found for “${item.display}”.`);
      return;
    }
    setResolvedShaCode(shaCode);

    setLoadingCoverage(true);
    try {
      const cr = await fetchPatientCrNumber(
        patientUuid,
        electiveCfg?.clientRegistryIdentifierTypeUuid ?? '',
      );
      if (!cr) {
        setCoverageError('Patient needs a Client Registry identifier to check SHA coverage.');
        return;
      }
      const intervention = await resolveCoverageForConcept(cr, locationUuid, shaCode);
      if (!intervention) {
        setCoverageError(`No SHA coverage found for ${shaCode}.`);
        return;
      }
      setCoverage(intervention);
      if (!intervention.needsManualPreauthApproval) {
        setCoverageError(
          `${shaCode} does not require elective (manual) preauth. Capture fields are hidden.`,
        );
      }
    } catch (e) {
      setCoverageError(e instanceof Error ? e.message : 'Coverage lookup failed');
    } finally {
      setLoadingCoverage(false);
    }
  };

  const showCaptureFields = Boolean(coverage?.needsManualPreauthApproval) && !loadingCoverage;

  const canSubmit = useMemo(() => {
    if (
      !patientUuid ||
      !locationUuid ||
      !providerUuid ||
      !selected ||
      !coverage?.needsManualPreauthApproval ||
      !expectedDate ||
      !(diagnosis?.conceptUuid ?? '').trim() ||
      submitting
    ) {
      return false;
    }

    // Elective Raise always requires clinical indications (except surgical block uses HPI etc.;
    // still required in formRelevant for isElective).
    if (!clinicalIndications.trim() && !specialty.requiresSurgicalPreauth) {
      return false;
    }
    if (specialty.requiresSurgicalPreauth) {
      if (
        !chiefComplaint.trim() ||
        !hpi.trim() ||
        !physicalExam.trim() ||
        !investigations.trim() ||
        !anaesthesia ||
        !surgeryDate
      ) {
        return false;
      }
      // When surgical-only, still require clinical indications for elective hold/raise
      if (!clinicalIndications.trim()) return false;
    }
    if (specialty.requiresRenalPreauth) {
      if (!clinicalIndications.trim() || !sessionsRequired.trim() || !frequency || !startDate) {
        return false;
      }
    }
    if (specialty.requiresOpticalPreauth || specialty.requiresRadiologyPreauth) {
      if (!clinicalIndications.trim()) return false;
    }
    if (specialty.requiresOpticalPreauth) {
      if (!necessity.trim() || !lensPrescription || !newOrReplacement) return false;
    }
    return true;
  }, [
    patientUuid,
    locationUuid,
    providerUuid,
    selected,
    coverage,
    expectedDate,
    diagnosis,
    submitting,
    clinicalIndications,
    specialty,
    chiefComplaint,
    hpi,
    physicalExam,
    investigations,
    anaesthesia,
    surgeryDate,
    sessionsRequired,
    frequency,
    startDate,
    necessity,
    lensPrescription,
    newOrReplacement,
  ]);

  const buildClinicalIndicationsForSave = () => {
    const parts = [clinicalIndications.trim()].filter(Boolean);
    if (specialty.requiresOncologyPreauth) {
      if (carcinomaStaging) parts.push(`Carcinoma staging: ${carcinomaStaging}`);
      if (metastases) parts.push(`Metastases: ${metastases}`);
      if (treatmentSetting) parts.push(`Treatment setting: ${treatmentSetting}`);
      if (comorbidity.trim()) parts.push(`Comorbidity: ${comorbidity.trim()}`);
      if (progressReport.trim()) parts.push(`Progress report: ${progressReport.trim()}`);
    }
    if (specialty.requiresOpticalPreauth && necessity.trim()) {
      // necessity has its own concept path? Raise sends separately; we keep clinical + necessity text
    }
    if (specialty.requiresSurgicalPreauth && vitalSigns.trim()) {
      parts.push(`Vital signs: ${vitalSigns.trim()}`);
    }
    return parts.join('\n');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selected || !coverage || !expectedDate || !diagnosis?.conceptUuid) return;
    if (!providerUuid) {
      showSnackbar({
        title: 'Missing provider',
        subtitle: 'Your session has no provider. Switch to a provider account and try again.',
        kind: 'error',
      });
      return;
    }
    setSubmitting(true);
    try {
      const captureInput = {
        patientUuid,
        locationUuid,
        encounterTypeUuid: electiveCfg?.encounterTypeUuid ?? '',
        providerUuid,
        encounterRoleUuid: electiveCfg?.encounterRoleUuid,
        plannedServiceObsConceptUuid,
        concept: selected,
        intervention: coverage,
        clinicalIndications: buildClinicalIndicationsForSave(),
        expectedServiceStartDate: expectedDate.toISOString(),
        chiefComplaint,
        hpi,
        physicalExam,
        investigations,
        anaesthesia: specialty.requiresSurgicalPreauth ? anaesthesia : undefined,
        surgeryDate:
          specialty.requiresSurgicalPreauth && surgeryDate
            ? surgeryDate.toISOString()
            : undefined,
        relatedToEmployment: specialty.requiresSurgicalPreauth ? relatedToEmployment : undefined,
        relatedToAccident: specialty.requiresSurgicalPreauth ? relatedToAccident : undefined,
        isCoInsured:
          specialty.requiresSurgicalPreauth ||
          specialty.requiresRenalPreauth ||
          specialty.requiresOncologyPreauth
            ? isCoInsured
            : undefined,
        coInsuranceDetails: isCoInsured ? coInsuranceDetails : undefined,
        sessionsRequired:
          specialty.requiresRenalPreauth || specialty.requiresOncologyPreauth
            ? sessionsRequired
            : undefined,
        frequency: specialty.requiresRenalPreauth ? frequency : undefined,
        startDate:
          (specialty.requiresRenalPreauth || specialty.requiresOncologyPreauth) && startDate
            ? startDate.toISOString()
            : undefined,
        necessity: specialty.requiresOpticalPreauth ? necessity : undefined,
        lensPrescription: specialty.requiresOpticalPreauth ? lensPrescription : undefined,
        newOrReplacement: specialty.requiresOpticalPreauth ? newOrReplacement : undefined,
        lensAmount: specialty.requiresOpticalPreauth ? lensAmount : undefined,
        eyeExamAmount: specialty.requiresOpticalPreauth ? eyeExamAmount : undefined,
        frameAmount: specialty.requiresOpticalPreauth ? frameAmount : undefined,
        diagnosis,
      };

      if (isEdit && editEncounterUuid) {
        await updateElectivePreauthEncounter(editEncounterUuid, captureInput, existingObs);
        if (editHoldId) {
          await syncElectiveHoldOrderConcept({
            holdId: editHoldId,
            encounterUuid: editEncounterUuid,
            conceptUuid: selected.uuid,
            currentOrderNo: editHoldOrderNo,
          });
        }
        showSnackbar({
          title: 'Elective request updated',
          subtitle: 'Encounter obs replaced (voided + new). Order concept saved for Create Order.',
          kind: 'success',
        });
      } else {
        const encounter = await createElectivePreauthEncounter(captureInput);

        await holdElectivePreauthRequest({
          patientUuid,
          locationUuid,
          encounterUuid: encounter.uuid,
          intervention: coverage,
          expectedServiceStartDate: expectedDate.toISOString(),
          conceptUuid: selected.uuid,
        });

        showSnackbar({
          title: 'Elective request saved',
          subtitle: 'Preauth encounter created. Accounting can raise from Elective requests.',
          kind: 'success',
        });
      }

      workspaceProps?.onSuccess?.();
      await closeWorkspace({ discardUnsavedChanges: true });
    } catch (err) {
      showSnackbar({
        title: isEdit ? 'Update failed' : 'Save failed',
        subtitle:
          err instanceof Error
            ? err.message
            : isEdit
              ? 'Could not update elective preauth encounter'
              : 'Could not save elective preauth encounter',
        kind: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const clinicalIndicationsFieldProps = {
    labelText: 'Clinical indications',
    value: clinicalIndications,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setClinicalIndications(e.target.value),
    rows: 3,
  };

  return (
    <Workspace2
      title={isEdit ? 'Edit elective preauth request' : 'Elective preauth request'}
      hasUnsavedChanges={isDirty}
    >
      <Form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
        <div className={styles.body}>
          {loadingEdit ? <InlineLoading description="Loading encounter for edit…" /> : null}
          {!patientUuid ? (
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              title="Missing patient"
              subtitle="Open this workspace from the patient chart Elective Preauth page."
            />
          ) : null}

          {patientUuid && !providerUuid ? (
            <InlineNotification
              kind="warning"
              lowContrast
              hideCloseButton
              title="No provider on session"
              subtitle="Log in as a provider user so the encounter can store who captured this request."
            />
          ) : null}

          <p className={styles.hint}>
            {isEdit
              ? 'Update the planned orderable concept and specialty fields. Saving voids replaced obs and creates new ones on the same encounter.'
              : 'Search the concept dictionary, select the orderable concept, then complete the specialty fields that match the Raise preauth form for this intervention.'}
          </p>

          <ComboBox
            className={styles.field}
            id="elective-ws-intervention-concept"
            titleText="Orderable concept (planned service)"
            helperText="This concept is used when Create Order runs after the preauth is ACTIVE or FINALISED."
            items={concepts}
            itemToString={(item: ElectiveConceptOption | null) => item?.display ?? ''}
            shouldFilterItem={() => true}
            selectedItem={selected}
            onChange={({ selectedItem }) => void onSelectConcept(selectedItem ?? null)}
            onInputChange={onConceptInputChange}
            placeholder="Type at least 2 characters to search concepts…"
          />
          {loadingConcepts ? <InlineLoading description="Searching concept dictionary…" /> : null}

          {loadingCoverage ? (
            <InlineLoading
              description={`Resolving ${resolvedShaCode ?? 'SHA code'} and checking coverage…`}
            />
          ) : null}

          {coverageError && !loadingCoverage ? (
            <InlineNotification
              kind="warning"
              lowContrast
              hideCloseButton
              title="Coverage"
              subtitle={coverageError}
            />
          ) : null}

          {coverage && !loadingCoverage ? (
            <div className={styles.coverage}>
              <div className={styles.tagRow}>
                <Tag type={coverage.needsManualPreauthApproval ? 'magenta' : 'gray'}>
                  {coverage.needsManualPreauthApproval ? 'Elective preauth required' : 'Not elective'}
                </Tag>
                {coverage.needsManualPreauthApproval ? (
                  <Tag type="blue">{specialtyLabel} preauth</Tag>
                ) : null}
              </div>
              <p>
                <strong>{coverage.code}</strong> — {coverage.name}
              </p>
              <p className={styles.meta}>
                Tariff: {coverage.overallTariff || coverage.kephLevelTarriff || '—'}
              </p>
            </div>
          ) : null}

          {showCaptureFields ? (
            <>
              <ComboBox
                className={styles.field}
                id="elective-ws-diagnosis"
                titleText="Diagnosis"
                helperText={diagnosisPrefillNote ?? undefined}
                items={diagnosisItems}
                itemToString={(item: ElectiveDiagnosisOption | null) =>
                  item
                    ? item.icd11Code
                      ? `${item.icd11Code} · ${item.display}`
                      : item.display
                    : ''
                }
                shouldFilterItem={() => true}
                selectedItem={diagnosis}
                onChange={({ selectedItem }) => {
                  setDiagnosis(selectedItem ?? null);
                  setDiagnosisPrefillNote(null);
                }}
                onInputChange={onDiagnosisInputChange}
                placeholder="Search diagnosis or pick from today’s visit…"
              />
              {loadingDiagnoses || searchingDiagnoses ? (
                <InlineLoading
                  description={
                    loadingDiagnoses ? 'Loading today’s diagnoses…' : 'Searching diagnoses…'
                  }
                />
              ) : null}

              <div className={styles.dateField}>
                <DatePicker
                  datePickerType="single"
                  dateFormat="d/m/Y"
                  value={expectedDate ?? undefined}
                  onChange={(dates: Date[]) => setExpectedDate(dates?.[0] ?? null)}
                >
                  <DatePickerInput
                    id="elective-ws-expected-date"
                    labelText="Expected service start date"
                    placeholder="dd/mm/yyyy"
                  />
                </DatePicker>
              </div>

              {showElectiveClinicalIndications &&
              !specialty.requiresRenalPreauth &&
              !specialty.requiresOpticalPreauth &&
              !specialty.requiresRadiologyPreauth ? (
                <TextArea
                  className={styles.field}
                  id="elective-ws-clinical-indications"
                  {...clinicalIndicationsFieldProps}
                />
              ) : null}

              {specialty.requiresSurgicalPreauth ? (
                <section className={styles.section}>
                  <h5>Surgical preauth</h5>
                  <TextArea
                    className={styles.field}
                    id="elective-ws-chief-complaint"
                    labelText="Chief complaint"
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    rows={2}
                  />
                  <TextInput
                    className={styles.field}
                    id="elective-ws-vital-signs"
                    labelText="Vital signs"
                    value={vitalSigns}
                    onChange={(e) => setVitalSigns(e.target.value)}
                  />
                  <TextArea
                    className={styles.field}
                    id="elective-ws-hpi"
                    labelText="History of present illness"
                    value={hpi}
                    onChange={(e) => setHpi(e.target.value)}
                    rows={2}
                  />
                  <TextArea
                    className={styles.field}
                    id="elective-ws-exam"
                    labelText="Physical examination"
                    value={physicalExam}
                    onChange={(e) => setPhysicalExam(e.target.value)}
                    rows={2}
                  />
                  <TextArea
                    className={styles.field}
                    id="elective-ws-investigations"
                    labelText="Investigation report details"
                    value={investigations}
                    onChange={(e) => setInvestigations(e.target.value)}
                    rows={2}
                  />
                  <div className={styles.row}>
                    <Dropdown
                      id="elective-ws-anaesthesia"
                      titleText="Type of anaesthesia"
                      label="Select"
                      items={ANAESTHESIA}
                      selectedItem={anaesthesia || null}
                      onChange={({ selectedItem }) => setAnaesthesia(selectedItem ?? '')}
                    />
                    <div className={styles.dateField}>
                      <DatePicker
                        datePickerType="single"
                        dateFormat="d/m/Y"
                        value={surgeryDate ?? undefined}
                        onChange={(dates: Date[]) => setSurgeryDate(dates?.[0] ?? null)}
                      >
                        <DatePickerInput
                          id="elective-ws-surgery-date"
                          labelText="Surgery date"
                          placeholder="dd/mm/yyyy"
                        />
                      </DatePicker>
                    </div>
                  </div>
                  <div className={styles.row}>
                    <Checkbox
                      id="elective-ws-related-employment"
                      labelText="Related to employment"
                      checked={relatedToEmployment}
                      onChange={(_, { checked }) => setRelatedToEmployment(checked)}
                    />
                    <Checkbox
                      id="elective-ws-related-accident"
                      labelText="Related to auto/other accident"
                      checked={relatedToAccident}
                      onChange={(_, { checked }) => setRelatedToAccident(checked)}
                    />
                    <Checkbox
                      id="elective-ws-surgical-co-insured"
                      labelText="Is co-insured"
                      checked={isCoInsured}
                      onChange={(_, { checked }) => setIsCoInsured(checked)}
                    />
                  </div>
                  {isCoInsured ? (
                    <TextArea
                      className={styles.field}
                      id="elective-ws-co-insurance-details"
                      labelText="Co-insurance details"
                      value={coInsuranceDetails}
                      onChange={(e) => setCoInsuranceDetails(e.target.value)}
                      rows={2}
                    />
                  ) : null}
                </section>
              ) : null}

              {specialty.requiresRenalPreauth ? (
                <section className={styles.section}>
                  <h5>Renal preauth</h5>
                  <div className={styles.row}>
                    <TextInput
                      id="elective-ws-sessions-required"
                      labelText="Number of sessions required"
                      value={sessionsRequired}
                      onChange={(e) => setSessionsRequired(e.target.value)}
                    />
                    <TextInput
                      id="elective-ws-cost-per-session"
                      labelText="Cost per session"
                      value={costPerSession}
                      onChange={(e) => setCostPerSession(e.target.value)}
                    />
                    <Dropdown
                      id="elective-ws-frequency"
                      titleText="Frequency of sessions"
                      label="Select"
                      items={FREQUENCY}
                      selectedItem={frequency || null}
                      onChange={({ selectedItem }) => setFrequency(selectedItem ?? '')}
                    />
                  </div>
                  <TextArea
                    className={styles.field}
                    id="elective-ws-renal-indications"
                    {...clinicalIndicationsFieldProps}
                  />
                  <div className={styles.row}>
                    <div className={styles.dateField}>
                      <DatePicker
                        datePickerType="single"
                        dateFormat="d/m/Y"
                        value={startDate ?? undefined}
                        onChange={(dates: Date[]) => setStartDate(dates?.[0] ?? null)}
                      >
                        <DatePickerInput
                          id="elective-ws-renal-start"
                          labelText="Start date"
                          placeholder="dd/mm/yyyy"
                        />
                      </DatePicker>
                    </div>
                    <Checkbox
                      id="elective-ws-renal-co-insured"
                      labelText="Is co-insured"
                      checked={isCoInsured}
                      onChange={(_, { checked }) => setIsCoInsured(checked)}
                    />
                  </div>
                  {isCoInsured ? (
                    <TextArea
                      className={styles.field}
                      id="elective-ws-renal-co-insurance-details"
                      labelText="Co-insurance details"
                      value={coInsuranceDetails}
                      onChange={(e) => setCoInsuranceDetails(e.target.value)}
                      rows={2}
                    />
                  ) : null}
                </section>
              ) : null}

              {specialty.requiresOpticalPreauth ? (
                <section className={styles.section}>
                  <h5>Optical preauth</h5>
                  <TextArea
                    className={styles.field}
                    id="elective-ws-optical-indications"
                    {...clinicalIndicationsFieldProps}
                  />
                  <TextArea
                    className={styles.field}
                    id="elective-ws-necessity"
                    labelText="Necessity of service"
                    value={necessity}
                    onChange={(e) => setNecessity(e.target.value)}
                    rows={2}
                  />
                  <div className={styles.row}>
                    <Dropdown
                      id="elective-ws-lens-rx"
                      titleText="Lens prescription"
                      label="Select"
                      items={LENS}
                      selectedItem={lensPrescription || null}
                      onChange={({ selectedItem }) => setLensPrescription(selectedItem ?? '')}
                    />
                    <Dropdown
                      id="elective-ws-new-or-repl"
                      titleText="New or replacement"
                      label="Select"
                      items={NEW_OR_REPL}
                      selectedItem={newOrReplacement || null}
                      onChange={({ selectedItem }) => setNewOrReplacement(selectedItem ?? '')}
                    />
                  </div>
                  <div className={styles.row}>
                    <TextInput
                      id="elective-ws-lens-amount"
                      labelText="Lens amount"
                      value={lensAmount}
                      onChange={(e) => setLensAmount(e.target.value)}
                    />
                    <TextInput
                      id="elective-ws-eye-exam-amount"
                      labelText="Eye examination amount"
                      value={eyeExamAmount}
                      onChange={(e) => setEyeExamAmount(e.target.value)}
                    />
                    <TextInput
                      id="elective-ws-frame-amount"
                      labelText="Frame amount"
                      value={frameAmount}
                      onChange={(e) => setFrameAmount(e.target.value)}
                    />
                  </div>
                </section>
              ) : null}

              {specialty.requiresOncologyPreauth ? (
                <section className={styles.section}>
                  <h5>Oncology preauth</h5>
                  <div className={styles.row}>
                    <Dropdown
                      id="elective-ws-carcinoma-staging"
                      titleText="Carcinoma staging"
                      label="Select"
                      items={STAGING}
                      selectedItem={carcinomaStaging || null}
                      onChange={({ selectedItem }) => setCarcinomaStaging(selectedItem ?? '')}
                    />
                    <Dropdown
                      id="elective-ws-metastases"
                      titleText="Metastases"
                      label="Select"
                      items={METASTASES}
                      selectedItem={metastases || null}
                      onChange={({ selectedItem }) => setMetastases(selectedItem ?? '')}
                    />
                    <Dropdown
                      id="elective-ws-treatment-setting"
                      titleText="Treatment setting"
                      label="Select"
                      items={TREATMENT}
                      selectedItem={treatmentSetting || null}
                      onChange={({ selectedItem }) => setTreatmentSetting(selectedItem ?? '')}
                    />
                  </div>
                  <TextArea
                    className={styles.field}
                    id="elective-ws-comorbidity"
                    labelText="Comorbidity"
                    value={comorbidity}
                    onChange={(e) => setComorbidity(e.target.value)}
                    rows={2}
                  />
                  <TextArea
                    className={styles.field}
                    id="elective-ws-progress-report"
                    labelText="Progress report"
                    value={progressReport}
                    onChange={(e) => setProgressReport(e.target.value)}
                    rows={2}
                  />
                  <div className={styles.row}>
                    <div className={styles.dateField}>
                      <DatePicker
                        datePickerType="single"
                        dateFormat="d/m/Y"
                        value={startDate ?? undefined}
                        onChange={(dates: Date[]) => setStartDate(dates?.[0] ?? null)}
                      >
                        <DatePickerInput
                          id="elective-ws-oncology-start"
                          labelText="Start date"
                          placeholder="dd/mm/yyyy"
                        />
                      </DatePicker>
                    </div>
                  </div>
                  <div className={styles.row}>
                    <TextInput
                      id="elective-ws-onc-sessions"
                      labelText="Number of sessions required"
                      value={sessionsRequired}
                      onChange={(e) => setSessionsRequired(e.target.value)}
                    />
                    <TextInput
                      id="elective-ws-onc-cost"
                      labelText="Cost per session"
                      value={costPerSession}
                      onChange={(e) => setCostPerSession(e.target.value)}
                    />
                    <Checkbox
                      id="elective-ws-onc-co-insured"
                      labelText="Is co-insured"
                      checked={isCoInsured}
                      onChange={(_, { checked }) => setIsCoInsured(checked)}
                    />
                  </div>
                  {isCoInsured ? (
                    <TextArea
                      className={styles.field}
                      id="elective-ws-onc-co-insurance-details"
                      labelText="Co-insurance details"
                      value={coInsuranceDetails}
                      onChange={(e) => setCoInsuranceDetails(e.target.value)}
                      rows={2}
                    />
                  ) : null}
                </section>
              ) : null}

              {specialty.requiresRadiologyPreauth ? (
                <section className={styles.section}>
                  <h5>Imaging / radiology preauth</h5>
                  <TextArea
                    className={styles.field}
                    id="elective-ws-imaging-indications"
                    {...clinicalIndicationsFieldProps}
                  />
                </section>
              ) : null}
            </>
          ) : null}
        </div>

        <ButtonSet className={styles.buttonSet}>
          <Button kind="secondary" onClick={() => void closeWorkspace()}>
            Cancel
          </Button>
          <Button kind="primary" type="submit" disabled={!canSubmit || loadingEdit}>
            {submitting
              ? isEdit
                ? 'Updating…'
                : 'Saving…'
              : isEdit
                ? 'Update elective request'
                : 'Save elective request'}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
};

export default ElectivePreauthRequestWorkspace;
