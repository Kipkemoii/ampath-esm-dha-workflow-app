import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MetricsCard,
  MetricsCardHeader,
  MetricsCardBody,
  MetricsCardItem,
} from '../../service-queues/metrics/metrics-cards/metrics-card.component';
import { useSession } from '@openmrs/esm-framework';
import { QUEUE_SERVICE_UUIDS } from '../../shared/constants/concepts';
import { getServiceQueueByLocationUuid } from '../../service-queues/service-queues.resource';
import { type QueueEntryResult } from '../../registry/types';

export default function TriageWaitingPatientsExtension() {
  const { t } = useTranslation();
  const [triageQueueEntries, setTriageQueueEntries] = useState<QueueEntryResult[]>([]);
  const session = useSession();
  const locationUuid = session.sessionLocation.uuid;
  const triageServiceUuid = QUEUE_SERVICE_UUIDS.TRIAGE_SERVICE_UUID;
  useEffect(() => {
    getTriageEntryQueues();
  }, []);

  const getTriageEntryQueues = async () => {
    const res = await getServiceQueueByLocationUuid(triageServiceUuid, locationUuid);
    setTriageQueueEntries(res);
  };

  const waitingPatientsCount = triageQueueEntries?.filter((p) => p.status === 'WAITING').length ?? 0;

  return (
    <MetricsCard>
      <MetricsCardHeader title={t('patientsInWaiting', 'Patients in waiting')} />
      <MetricsCardBody>
        <MetricsCardItem label={t('patients', 'Patients')} value={waitingPatientsCount ? waitingPatientsCount : '--'} />
      </MetricsCardBody>
    </MetricsCard>
  );
}
