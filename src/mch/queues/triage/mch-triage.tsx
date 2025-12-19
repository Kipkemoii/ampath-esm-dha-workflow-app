import React from 'react';
import ServiceQueueComponent from '../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../shared/constants/concepts';

interface TriageProps {}
const MchTriage: React.FC<TriageProps> = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent serviceTypeUuid={QUEUE_SERVICE_UUIDS.MCH_TRIAGE_SERVICE_UUID} title="MCH Triage" />
      </div>
    </>
  );
};
export default MchTriage;
