import React from 'react';
import { QUEUE_SERVICE_UUIDS } from '../../shared/constants/concepts';
import ServiceQueueComponent from '../service-queue/service-queue.component';
import MetricsContainer from '../metrics/metrics-container.component';
const Consultation: React.FC = () => {
  return (
    <>
      <MetricsContainer />
      <ServiceQueueComponent
        serviceTypeUuid={QUEUE_SERVICE_UUIDS.CLINICAL_CONSULTATION_SERVICE_UUID}
        title="Clinical Consultation"
      />
    </>
  );
};

export default Consultation;
