import React from 'react';
import { useSession } from '@openmrs/esm-framework';

import { Tile } from '@carbon/react';
import Room from './room/room.component';
import styles from './triage.module.scss';
import useTriagePatients from './triage.resource';

interface TriageProps {}
const Triage: React.FC<TriageProps> = () => {
  const session = useSession();

  const locationUuid = session.sessionLocation.uuid;
  const { patients, isLoading, isError } = useTriagePatients(locationUuid);

  if (isLoading) return <p>Loading...</p>;
  if (isError) return <p>Error loading patients</p>;
  return (
    <>
      <div className={styles.container}>
        <Tile className={styles.card}>
          <h4 className={styles.title}>Patients in waiting</h4>
          <h3>{patients.length}</h3>
        </Tile>
        <Tile className={styles.card}>
          <h4>Patients attended to</h4>
        </Tile>
      </div>
      <div style={{ display: 'flex' }}>
        <Room name="Triage 1" patients={patients} />
        <Room name="Triage 2" patients={patients} />
      </div>
    </>
  );
};
export default Triage;
