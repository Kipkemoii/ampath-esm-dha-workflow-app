import React from 'react';
import { ExtensionSlot } from '@openmrs/esm-framework';
import styles from './metrics.scss';

export interface Service {
  display: string;
  uuid?: string;
}

function TriageMetricsContainer() {
  return <ExtensionSlot name="triage-metrics-slot" className={styles.cardContainer} data-testid="clinic-metrics" />;
}

export default TriageMetricsContainer;
