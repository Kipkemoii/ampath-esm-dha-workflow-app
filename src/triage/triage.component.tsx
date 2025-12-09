import React from 'react';

import TriageMetricsContainer from './metrics/triage-metrics.component';
import ServiceQueueComponent from '../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../shared/constants/concepts';

interface TriageProps {}
const Triage: React.FC<TriageProps> = () => {
  return (
    <>
      <TriageMetricsContainer />
      <div>
        <ServiceQueueComponent serviceTypeUuid={QUEUE_SERVICE_UUIDS.TRIAGE_SERVICE_UUID} title="Triage" />
      </div>
    </>
  );
};
export default Triage;
