import React from 'react';
import ServiceQueueComponent from '../../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../../shared/constants/concepts';

interface HDUConsultationProps {}
const HDUConsultation: React.FC<HDUConsultationProps> = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent
          serviceTypeUuid={QUEUE_SERVICE_UUIDS.HDU_CONSULTATION_SERVICE_UUID}
          title="HDU Consultation"
        />
      </div>
    </>
  );
};
export default HDUConsultation;
