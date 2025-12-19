import React from 'react';
import ServiceQueueComponent from '../../../service-queues/service-queue/service-queue.component';
import { QUEUE_SERVICE_UUIDS } from '../../../shared/constants/concepts';

interface MchConsultationProps {}
const MchConsultation: React.FC<MchConsultationProps> = () => {
  return (
    <>
      <div>
        <ServiceQueueComponent
          serviceTypeUuid={QUEUE_SERVICE_UUIDS.MCH_CLINICAL_CONSULTATION_SERVICE_UUID}
          title="MCH Consultation"
        />
      </div>
    </>
  );
};
export default MchConsultation;
