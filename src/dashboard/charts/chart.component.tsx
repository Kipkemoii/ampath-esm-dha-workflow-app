import { embedDashboard } from '@superset-ui/embedded-sdk';
import React, { useEffect, useRef, useState } from 'react';
import { fetchGuestToken } from '../../resources/superset.resource';
import { useSession } from '@openmrs/esm-framework';

import { getSubDomainUrl } from '../../shared/utils/get-base-url';

import styles from './chart.component.scss';

interface ChartProps {}

const Chart: React.FC<ChartProps> = () => {
  const ref = useRef<HTMLDivElement>(null);
  const session = useSession();
  const locationUuid = session.sessionLocation.uuid;
  const [subDomainUrl, setSubDomainUrl] = useState<string | null>(null);
  useEffect(() => {
    const fetchSubDomainUrl = async () => {
      const url = await getSubDomainUrl();
      setSubDomainUrl(url);
    };

    fetchSubDomainUrl();
  }, []);
  const container = document.getElementById('my-superset-container');

  const firstChild = container?.children?.[0] as HTMLElement | undefined;

  if (firstChild) {
    firstChild.style.width = '100%';
    firstChild.style.height = '100%';
  }

  useEffect(() => {
    embedDashboard({
      id: '81cc98fd-5195-4404-bf38-2c8cd5509747',
      supersetDomain: `${subDomainUrl}/superset`,
      mountPoint: ref.current!,
      fetchGuestToken: async () => await fetchGuestToken(locationUuid),
      dashboardUiConfig: {
        hideTitle: true,
        filters: {
          expanded: true,
        },
      },
    });
  }, []);
  return (
    <>
      <div id="my-superset-container" className={styles.container} ref={ref}></div>
    </>
  );
};
export default Chart;
