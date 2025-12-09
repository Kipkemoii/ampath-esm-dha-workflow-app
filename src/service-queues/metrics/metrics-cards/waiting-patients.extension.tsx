import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MetricsCard, MetricsCardHeader, MetricsCardBody, MetricsCardItem } from './metrics-card.component';
import { getServiceQueueByLocationUuid } from '../../service-queues.resource';
import { QUEUE_SERVICE_UUIDS } from '../../../shared/constants/concepts';
import { useSession } from '@openmrs/esm-framework';
import { type QueueEntryResult } from '../../../registry/types';

export default function WaitingPatientsExtension() {
  const { t } = useTranslation();
  const [consultationQueueEntries, setConsultationQueueEntries] = useState<QueueEntryResult[]>([]);
  const session = useSession();
  const locationUuid = session.sessionLocation.uuid;
  const consultationServiceUuid = QUEUE_SERVICE_UUIDS.CLINICAL_CONSULTATION_SERVICE_UUID;
  useEffect(() => {
    getConsultationEntryQueues();
  }, []);

  const getConsultationEntryQueues = async () => {
    const res = await getServiceQueueByLocationUuid(consultationServiceUuid, locationUuid);
    setConsultationQueueEntries(res);
  };

  const waitingPatientsCount = consultationQueueEntries?.filter((p) => p.status === 'WAITING').length ?? 0;

  return (
    <MetricsCard>
      <MetricsCardHeader title={t('patientsInWaiting', 'Patients in waiting')} />
      <MetricsCardBody>
        <MetricsCardItem label={t('patients', 'Patients')} value={waitingPatientsCount ? waitingPatientsCount : '--'} />
      </MetricsCardBody>
    </MetricsCard>
  );
}
