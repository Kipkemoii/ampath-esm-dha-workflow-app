import React from 'react';
import styles from './stat-details.component.scss';
import { type QueueEntryResult } from '../../../../registry/types';
import StatCard from '../stat-card/stat-card.component';

interface StatDetailsProps {
  queueEntries: QueueEntryResult[];
}

const StatDetails: React.FC<StatDetailsProps> = ({ queueEntries }) => {
  if (!queueEntries) {
    return 'No queue entry records';
  }
  const getCategoryTotal = (categories: string[]) => {
    let total = 0;
    queueEntries.forEach((q) => {
      if (categories.includes(q.status)) {
        total += 1;
      }
    });
    return total;
  };
  const patientsInWaiting = getCategoryTotal(['WAITING']);
  const patientsAttendedTo = getCategoryTotal(['IN SERVICE', 'COMPLETED']);

  return (
    <div className={styles.statsSection}>
      <StatCard title="Patients in waiting" count={patientsInWaiting ?? 0} />
      <StatCard title="Patients attended to" count={patientsAttendedTo ?? 0} />
    </div>
  );
};

export default StatDetails;
