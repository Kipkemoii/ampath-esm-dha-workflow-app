import React from 'react';
import styles from './aggregate-stat-card.scss';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';

interface AgregateStatCardProps {
  title: string;
  totalCount: number;
  stats: { title: string; count: number }[];
  onStatDetailsRequest: () => void;
}

const AgregateStatCard: React.FC<AgregateStatCardProps> = ({ title, totalCount, stats, onStatDetailsRequest }) => {
  if (!title) {
    return <></>;
  }
  return (
    <div className={styles.aggregateStatsCard}>
      <div className={styles.aggregateStatsCardHeader}>
        <h5>{title}</h5>
        <h1 className={styles.totalCount} onClick={onStatDetailsRequest}>
          {totalCount}
        </h1>
      </div>
      <div className={styles.stats}>
        {stats.map((val, index) => {
          return (
            <>
              <div className={styles.statDetails}>
                <div className={styles.title}>{val.title} :</div>
                <div className={styles.count}>
                  <strong>{val.count}</strong>
                </div>
              </div>
            </>
          );
        })}
      </div>
    </div>
  );
};

export default AgregateStatCard;
