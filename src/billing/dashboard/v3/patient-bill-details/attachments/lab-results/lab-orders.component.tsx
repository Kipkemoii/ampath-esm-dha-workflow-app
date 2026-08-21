import React, { forwardRef, useEffect, useState } from 'react';
import styles from './lab-orders.scss';
import { type VisitSummaryResponse, type LabOrder, type LabResult } from '../type';
import { fetchCaseSummary } from '../../../../../billing-claims.resource';
import { showSnackbar, useSession } from '@openmrs/esm-framework';

interface LabOrdersComponentProps {
  patientUuid: string;
  billingDate?: string;
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isOutOfRange(result: LabResult): boolean {
  if (!result.range) return false;
  const match = result.range.match(/(-?\d+(\.\d+)?)\s*[–-]\s*(-?\d+(\.\d+)?)/);
  const value = Number(result.value);
  if (!match || Number.isNaN(value)) return false;
  const low = Number(match[1]);
  const high = Number(match[3]);
  return value < low || value > high;
}

function orderStatus(order: LabOrder): { label: string; tone: 'pending' | 'hold' | 'done' } {
  if (order.pending) return { label: 'Pending', tone: 'pending' };
  if (order.fulfillerStatus === 'ON_HOLD') return { label: 'On Hold', tone: 'hold' };
  if (order.results.length > 0) return { label: 'Resulted', tone: 'done' };
  return { label: order.fulfillerStatus || 'Unknown', tone: 'pending' };
}

const LabOrdersComponent = forwardRef<HTMLDivElement, LabOrdersComponentProps>(({ patientUuid, billingDate }, ref) => {
  const [labOrders, setLabOrders] = useState<VisitSummaryResponse>();
  const session = useSession();
  const locationUuid = session?.sessionLocation?.uuid;
  const locationName = session?.sessionLocation?.display;
  const user = session?.user?.display;
  const formatDate = (date?: string | Date | null): string => {
    if (!date) return '—';

    return new Intl.DateTimeFormat('en-KE', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(new Date(date));
  };

  const getLabOrders = async (locationUuid: string) => {
    try {
      const res: VisitSummaryResponse = await fetchCaseSummary(locationUuid!, patientUuid);
      setLabOrders(res);
    } catch (err) {
      showSnackbar({
        kind: 'error',
        title: 'An error occured while fetching Case summary',
        subtitle: 'An error occured while fetching Case summary. Please try again!',
      });
    }
  };

  useEffect(() => {
    if (!locationUuid) return;
    getLabOrders(locationUuid);
  }, [locationUuid, session]);
  const resultedOrders = labOrders?.labOrders?.filter((o) => o.results.length > 0);
  const pendingOrders = labOrders?.labOrders?.filter((o) => o.results.length === 0);

  return (
    <div className={styles['lo-root']} ref={ref}>
      <div className={styles['lo-shell']}>
        <header className={styles['lo-header']}>
          <div className={styles['lo-header-bar']} />
          <div className={styles['lo-header-info']}>
            <p className={styles['lo-org']}>{locationName}</p>
            <h1 className={styles['lo-title']}>Laboratory Orders &amp; Results</h1>
          </div>
        </header>

        <div className={styles['lo-identity']}>
          <div className={styles['lo-field']}>
            <div className={styles['lo-field-label']}>Patient</div>
            <div className={`${styles['lo-field-value']} ${styles['lo-name-value']}`}>
              {labOrders?.demographics?.name}
            </div>
          </div>
          <div className={styles['lo-field']}>
            <div className={styles['lo-field-label']}>Patient ID</div>
            <div className={styles['lo-field-value']}>{labOrders?.demographics?.crNumber}</div>
          </div>
          <div className={styles['lo-field']}>
            <div className={styles['lo-field-label']}>Total Orders</div>
            <div className={styles['lo-field-value']}>{labOrders?.labOrders?.length}</div>
          </div>
        </div>

        <section className={styles['lo-section']}>
          <h2 className={styles['lo-section-title']}>
            <span className={styles['lo-section-num']}>1</span> Results
          </h2>
          <div className={styles['lo-section-body']}>
            {labOrders?.labOrders?.length === 0 ? (
              <div className={styles['lo-empty']}>No results available.</div>
            ) : (
              <table className={styles['lo-table']}>
                <thead>
                  <tr>
                    <th>Test</th>
                    <th>Order No</th>
                    <th>Ordered</th>
                    <th className={styles['lo-num-col']}>Result</th>
                    <th>Units</th>
                    <th>Reference Range</th>
                    <th>Result Date</th>
                  </tr>
                </thead>
                <tbody>
                  {resultedOrders?.map((order) =>
                    order.results.map((result, i) => {
                      const flagged = isOutOfRange(result);
                      return (
                        <tr key={`${order.uuid}-${i}`}>
                          <td className={styles['lo-test-name']}>{result.test}</td>
                          <td>{order.orderNumber}</td>
                          <td>{formatDate(order.orderedDate)}</td>
                          <td className={styles['lo-num-col']}>
                            <span className={flagged ? styles['lo-value-flagged'] : undefined}>{result.value}</span>
                          </td>
                          <td>{result.units || '—'}</td>
                          <td>{result.range || '—'}</td>
                          <td>{formatDateTime(result.datetime)}</td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className={styles['lo-section']}>
          <h2 className={styles['lo-section-title']}>
            <span className={styles['lo-section-num']}>2</span> Pending / Outstanding Orders
          </h2>
          <div className={styles['lo-section-body']}>
            {pendingOrders?.length === 0 ? (
              <div className={styles['lo-empty']}>No pending orders.</div>
            ) : (
              <table className={styles['lo-table']}>
                <thead>
                  <tr>
                    <th>Test</th>
                    <th>Order No</th>
                    <th>Ordered</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingOrders?.map((order) => {
                    const status = orderStatus(order);
                    return (
                      <tr key={order.uuid}>
                        <td className={styles['lo-test-name']}>{order.test}</td>
                        <td>{order.orderNumber}</td>
                        <td>{formatDate(order.orderedDate)}</td>
                        <td>
                          <span className={`${styles['lo-status-pill']} ${styles[`lo-status-${status.tone}`]}`}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <div className={styles['lo-footer']}>Confidential — For authorized clinical use only</div>
      </div>
    </div>
  );
});

LabOrdersComponent.displayName = 'LabOrdersComponent';

export default LabOrdersComponent;
