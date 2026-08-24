import React from 'react';
import ServiceQueueComponent from '../../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../../shared/constants/concepts';

const ICUBurnsConsultation: React.FC = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent
          serviceTypeUuid={QUEUE_SERVICE_UUIDS.ICU_BURNS_UNIT_CONSULTATION_SERVICE_UUID}
          title="ICU Burns Consultation"
        />
      </div>
    </>
  );
};
export default ICUBurnsConsultation;
