import { FluidDropdown, Tile } from '@carbon/react';
import React, { useState } from 'react';

import styles from './overview.component.scss';
import { type QueueEntryResult } from '../../registry/types';
import PatientList from '../patient-list/patient-list.component';

interface OverviewProps {
  triageCount?: QueueEntryResult[];
  consultationCount?: QueueEntryResult[];
}

const Overview: React.FC<OverviewProps> = ({ triageCount, consultationCount }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const triagePatients = triageCount?.length ?? 0;
  const consultationPatients = consultationCount?.length ?? 0;
  const dropDownItems = [
    'Total Patients',
    'Triage Patients',
    'Consultation Patients',
    'Walk-In Patients',
    'Emergency Patients',
  ];

  const handleDropdownChange = (data: { selectedItem: string }) => {
    const value = data.selectedItem;
    setSelected(value);
  };

  let selectedPatients: QueueEntryResult[] = [];

  switch (selected) {
    case 'Triage Patients':
      selectedPatients = triageCount ?? [];
      break;

    case 'Consultation Patients':
      selectedPatients = consultationCount ?? [];
      break;
    case 'Walk-In Patients':
      selectedPatients = [];
      break;
    case 'Emergency Patients':
      selectedPatients = [];
      break;

    case 'Total Patients':
      selectedPatients = [...(triageCount ?? []), ...(consultationCount ?? [])];
      break;

    default:
      selectedPatients = [...(triageCount ?? []), ...(consultationCount ?? [])];
      break;
  }

  return (
    <>
      <div className={styles.container}>
        <Tile className={styles.card}>
          <h3>Total Patients Today</h3>
          <h4>Patients</h4>
          <h4>{triagePatients + consultationPatients}</h4>
        </Tile>
        <Tile className={styles.card}>
          <h3>Patients in Queue Today</h3>
          <h4>Patients</h4>
          <h4>{triagePatients + consultationPatients}</h4>
        </Tile>
        <Tile className={styles.card}>
          <h3>Patients in Triage </h3>
          <h4>Patients</h4>
          <h4>{triagePatients}</h4>
        </Tile>
        <Tile className={styles.card}>
          <h3>Patients in Cosultation </h3>
          <h4>Patients</h4>
          <h4>{consultationPatients}</h4>
        </Tile>
        <Tile className={styles.card}>
          <h3>Walk-ins Today </h3>
          <h4>Patients</h4>
          <h4>0</h4>
        </Tile>
        <Tile className={styles.card}>
          <h3>Emergencies Today </h3>
          <h4>Patients</h4>
          <h4>0</h4>
        </Tile>
      </div>
      <FluidDropdown
        className={styles.dropdownItem}
        id={''}
        items={dropDownItems}
        label={'Total Patients'}
        titleText={''}
        onChange={handleDropdownChange}
      ></FluidDropdown>
      <PatientList patients={selectedPatients} />
    </>
  );
};

export default Overview;
