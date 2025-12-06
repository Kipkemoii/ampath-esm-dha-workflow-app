import React from 'react';
import { navigate } from '@openmrs/esm-framework';
import { Button, Tile } from '@carbon/react';
import { type Patient } from '../types';
import styles from './room.scss';

interface RoomProps {
  locationUuid?: string;
  name: string;
  patients: Array<Patient>;
}

const Room: React.FC<RoomProps> = ({ name, locationUuid, patients }) => {
  function openPatientChart(patientUuid: string) {
    navigate({
      to: `patient/${patientUuid}/chart`,
    });
  }
  return (
    <div className={styles.room}>
      <h4 className={styles.roomName}>{name}</h4>

      <div className={styles.container}>
        {patients.map((patient) => (
          <Tile key={patient.uuid}>
            <h5>{patient.display}</h5>
            <p className={styles.field}>Age: {patient.patient.person.age}</p>
            <p className={styles.field}>Status: {patient.status.display}</p>
            <Button onClick={() => openPatientChart(patient.patient.uuid)} size="sm" className={styles.button}>
              Start
            </Button>
          </Tile>
        ))}
      </div>
    </div>
  );
};

export default Room;
