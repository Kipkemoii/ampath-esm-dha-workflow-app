import React from 'react';
import ServiceQueueComponent from '../../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../../shared/constants/concepts';

const ICUConsultation: React.FC = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent
          serviceTypeUuid={QUEUE_SERVICE_UUIDS.ICU_CONSULTATION_SERVICE_UUID}
          title="ICU Consultation"
        />
      </div>
    </>
  );
};
export default ICUConsultation;
