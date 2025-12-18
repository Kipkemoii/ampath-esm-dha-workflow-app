import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  ComboBox,
  InlineLoading,
  Modal,
  ModalBody,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import styles from './send-to-triage.modal.scss';
import { type Patient, useVisitTypes, useSession, showSnackbar, type VisitType } from '@openmrs/esm-framework';
import { type HieClient, type CreateVisitDto, type QueueEntryDto, type ServiceQueue } from '../../types';
import { createQueueEntry, fetchServiceQueuesByLocationUuid } from '../../../resources/queue.resource';
import { QUEUE_PRIORITIES_UUIDS, QUEUE_STATUS_UUIDS } from '../../../shared/constants/concepts';
import { createVisit } from '../../../resources/visit.resource';

interface SendToTriageModalProps {
  patients: Patient[];
  open: boolean;
  onModalClose: (modalCloseResp?: { success: boolean }) => void;
  onSubmit: () => void;
  client: HieClient;
  onCreateAmrsPatient: (client: HieClient) => void;
  onManualRegistration: () => void;
}

const SendToTriageModal: React.FC<SendToTriageModalProps> = ({
  patients,
  open,
  onModalClose,
  onSubmit,
  client,
  onCreateAmrsPatient,
  onManualRegistration,
}) => {
  const [selectedPatient, setSelectedPatient] = useState<Patient>();
  const [selectedVisitType, setSelectedVisitType] = useState<string>();
  const [serviceQueues, setServiceQueues] = useState<ServiceQueue[]>();
  const [selectedServiceQueue, setSelectedServiceQueue] = useState<string>();
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const visitTypes = useVisitTypes();
  const session = useSession();
  const locationUuid = session.sessionLocation.uuid;
  const visitTypeOptions = useMemo(() => generateVisitTypeOptions(), [visitTypes]);
  useEffect(() => {
    getServiceQueues();
  }, [patients]);
  if (!patients) {
    return <>No Client data</>;
  }
  const registerOnAfyaYangu = () => {
    window.open('https://afyayangu.go.ke/', '_blank');
  };
  const sendToTriage = async () => {
    setLoading(true);
    try {
      const newVisit = await createPatientVisit();
      if (newVisit) {
        const addToTriageQueueDto: QueueEntryDto = generateAddToTriageDto(newVisit.uuid);
        const queueEntryResp = await createQueueEntry(addToTriageQueueDto);
        if (queueEntryResp) {
          showAlert('success', 'Patient has succesfully been moved to the Triage queue', '');
          onModalClose({ success: true });
        }
      }
    } catch (error) {
      showAlert('error', 'Error creating visit', '');
    } finally {
      setLoading(false);
    }
  };
  const generateAddToTriageDto = (newVisitUuid: string): QueueEntryDto => {
    const payload: QueueEntryDto = {
      visit: {
        uuid: newVisitUuid,
      },
      queueEntry: {
        status: {
          uuid: QUEUE_STATUS_UUIDS.WAITING_UUID,
        },
        priority: {
          uuid: selectedPriority,
        },
        queue: {
          uuid: selectedServiceQueue,
        },
        patient: {
          uuid: selectedPatient.uuid,
        },
        startedAt: new Date().toISOString(),
        sortWeight: 0,
      },
    };
    return payload;
  };
  const onPatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
  };
  const getServiceQueues = async () => {
    const resp = await fetchServiceQueuesByLocationUuid(locationUuid);
    if (resp && resp.results) {
      setServiceQueues(resp.results);
    }
  };
  const visitTypeChangeHandler = (selectedVisitType: { selectedItem: { id: string; text: string } }) => {
    const vt = selectedVisitType.selectedItem.id;
    setSelectedVisitType(vt);
  };
  const serviceChangeHandler = ($event: any) => {
    const sq = $event.target.value as unknown as string;
    setSelectedServiceQueue(sq);
  };
  const priorityChangeHandler = (priorityUuid: string) => {
    setSelectedPriority(priorityUuid);
  };
  const createPatientVisit = async () => {
    const visitDto = getCreateVisitDto();
    if (!isValidCreateVisitDto(visitDto)) {
      return false;
    }

    const result = await createVisit(visitDto);
    if (result) {
      showAlert('success', 'Visit has been created succesfully', '');
      return result;
    } else {
      showAlert('error', 'Error creating patient visit', '');
      throw new Error('Error creating patient visit');
    }
  };
  const isValidCreateVisitDto = (createVisitDto: CreateVisitDto): boolean => {
    if (!createVisitDto.location) {
      showAlert('error', 'Missing location in create visits', '');
      return false;
    }
    if (!createVisitDto.patient) {
      showAlert('error', 'Please select a patient', '');
      return false;
    }

    if (!createVisitDto.visitType) {
      showAlert('error', 'Please select a visit', '');
      return false;
    }
    return true;
  };
  const getCreateVisitDto = (): CreateVisitDto => {
    return {
      visitType: selectedVisitType,
      location: locationUuid,
      startDatetime: null,
      stopDatetime: null,
      patient: selectedPatient?.uuid ?? '',
    };
  };
  const showAlert = (alertType: 'error' | 'success', title: string, subtitle: string) => {
    showSnackbar({
      kind: alertType,
      title: title,
      subtitle: subtitle,
    });
  };

  function generateVisitTypeOptions() {
    return visitTypes.map((vt: VisitType) => {
      return {
        id: vt.uuid,
        text: vt.display,
      };
    });
  }

  return (
    <>
      <Modal
        open={open}
        size="md"
        onSecondarySubmit={() => onModalClose({ success: false })}
        onRequestClose={() => onModalClose({ success: false })}
        onRequestSubmit={registerOnAfyaYangu}
        primaryButtonText="Register on Afya Yangu"
        secondaryButtonText="Cancel"
      >
        <ModalBody>
          <div className={styles.clientDetailsLayout}>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>Send To Triage</h4>
            </div>
            {patients.length > 0 ? (
              <div className={styles.sectionContent}>
                <div className={styles.patientSelect}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader>No</TableHeader>
                        <TableHeader>Name</TableHeader>
                        <TableHeader>Gender</TableHeader>
                        <TableHeader>Select Patient</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {patients.map((p, index) => (
                        <TableRow key={p.uuid}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{p.person.preferredName.display}</TableCell>
                          <TableCell>{p.person.gender}</TableCell>
                          <TableCell>
                            <Checkbox id={p.uuid} labelText="" onChange={() => onPatientSelect(p)} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className={styles.formSection}>
                  <div className={styles.formRow}>
                    <div className={styles.formControl}>
                      <ComboBox
                        onChange={visitTypeChangeHandler}
                        id="visit-type-combobox"
                        items={visitTypeOptions}
                        itemToString={(item) => (item ? item.text : '')}
                        titleText="Select a Visit Type"
                      />
                    </div>
                    <div className={styles.formControl}>
                      <Select id="service" labelText="Select a Service" onChange={serviceChangeHandler}>
                        <SelectItem value="" text="Select" />;
                        {serviceQueues &&
                          serviceQueues.map((sq) => {
                            return <SelectItem value={sq.uuid} text={sq.display} />;
                          })}
                      </Select>
                    </div>
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formControl}>
                      <Select
                        id="priority"
                        labelText="Select Priority"
                        onChange={($event) => priorityChangeHandler($event.target.value)}
                      >
                        <SelectItem value="" text="Select" />;
                        <SelectItem value={QUEUE_PRIORITIES_UUIDS.NORMAL_PRIORITY_UUID} text="NORMAL" />;
                        <SelectItem value={QUEUE_PRIORITIES_UUIDS.EMERGENCY_PRIORITY_UUID} text="EMERGENCY" />;
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <></>
            )}
            <div className={styles.actionSection}>
              {patients.length > 0 ? (
                <div className={styles.btnContainer}>
                  <Button className={styles.greenBtn} onClick={sendToTriage}>
                    {loading ? <InlineLoading description="Sending To Triage..." /> : 'Send To Triage'}
                  </Button>
                </div>
              ) : (
                <>
                  <div className={styles.patientAction}>
                    <div className={styles.btnContainer}>
                      <Button kind="primary" onClick={() => onCreateAmrsPatient(client)}>
                        Automatically Register in AMRS
                      </Button>
                    </div>
                    <div className={styles.btnContainer}>
                      <Button kind="secondary" onClick={onManualRegistration}>
                        Manually Register
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default SendToTriageModal;
