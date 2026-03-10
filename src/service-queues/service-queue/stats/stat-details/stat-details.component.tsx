import React, { useMemo } from 'react';
import styles from './stat-details.component.scss';
import { type QueueEntryResult } from '../../../../registry/types';
import StatCard from '../../../../shared/ui/stat-card/stat-card.component';
import { type ServiceQueueDailyReport } from '../../../../shared/types';
import AgregateStatCard from '../../../../shared/ui/aggregate-stat-card/aggregate-stat-card';

interface StatDetailsProps {
  queueEntries: QueueEntryResult[];
  report: ServiceQueueDailyReport[];
  onStatDetailsRequest: () => void;
}

const StatDetails: React.FC<StatDetailsProps> = ({ queueEntries, report, onStatDetailsRequest }) => {
  const patientsInWaiting = useMemo(() => getCategoryTotal(['WAITING']), [queueEntries]);
  const patientsAttendedTo = useMemo(() => getCategoryTotal(['IN SERVICE', 'COMPLETED']), [queueEntries]);
  const patientsCheckedIn = useMemo(() => getTotalCheckedIn(), [report]);
  const aggregateStats = useMemo(() => getAggregateStats(), [report]);
  if (!queueEntries) {
    return 'No queue entry records';
  }
  function getCategoryTotal(categories: string[]) {
    let total = 0;
    queueEntries.forEach((q) => {
      if (categories.includes(q.status)) {
        total += 1;
      }
    });
    return total;
  }
  function getTotalCheckedIn() {
    let total = 0;
    report.forEach((r) => {
      total += r.patients;
    });
    return total;
  }
  function getAggregateStats() {
    return report.map((r) => {
      return {
        title: r.queue_room_name,
        count: r.patients,
      };
    });
  }

  return (
    <div className={styles.statsSection}>
      <div className={styles.aggregate}>
        <AgregateStatCard
          title="Total Checked In"
          totalCount={patientsCheckedIn ?? 0}
          stats={aggregateStats}
          onStatDetailsRequest={onStatDetailsRequest}
        />
      </div>
      <StatCard title="Patients in waiting" count={patientsInWaiting ?? 0} />
      <StatCard title="Patients attended to" count={patientsAttendedTo ?? 0} />
    </div>
  );
};

export default StatDetails;
