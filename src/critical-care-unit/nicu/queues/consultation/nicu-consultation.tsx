import React from 'react';
import ServiceQueueComponent from '../../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../../shared/constants/concepts';

const NICUConsultation: React.FC = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent
          serviceTypeUuid={QUEUE_SERVICE_UUIDS.NICU_NBU_CONSULTATION_SERVICE_UUID}
          title="NICU/NBU Consultation"
        />
      </div>
    </>
  );
};
export default NICUConsultation;
