import React from 'react';
import styles from './stat-card.component.scss';

interface StatCardProps {
  title: string;
  count: number;
}

const StatCard: React.FC<StatCardProps> = ({ title, count }) => {
  if (!title) {
    return <></>;
  }
  return (
    <div className={styles.statsCard}>
      <div className={styles.statsCardHeader}>
        <h5>{title}</h5>
        <h1>{count}</h1>
      </div>
    </div>
  );
};

export default StatCard;
