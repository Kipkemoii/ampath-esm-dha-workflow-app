import React, { forwardRef } from 'react';
import { type VisitIntervention } from '../../types';
import styles from './final-bill.scss';

interface FinalBillComponentProps {
  bill?: any;
}

function formatCurrency(value?: number | string) {
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const FinalBillComponent = forwardRef<HTMLDivElement, FinalBillComponentProps>(({ bill }, ref) => {
  if (!bill) {
    return (
      <div ref={ref} className={styles.fbRoot}>
        <div className={styles.fbEmpty}>No bill data available.</div>
      </div>
    );
  }

  // Some callers pass a single flattened bill item, others may pass a full bill with
  // an `items` array. Normalise to a list so the table always has a consistent shape,
  // without silently dropping data either caller might send.
  const items =
    Array.isArray(bill) && bill.length > 0
      ? bill
      : [
          {
            billable_service: bill.billable_service,
            intervention_code: bill.intervention_code,
            order_no: bill.order_no,
            service_type: bill.service_type,
            payment_scheme: bill.payment_scheme,
            payment_status: bill.payment_status,
            item_quantity: bill.item_quantity,
            item_price: bill.item_price,
          },
        ];

  const total = items.reduce(
    (sum: number, item: any) => sum + (Number(item.item_quantity) || 0) * (Number(item.item_price) || 0),
    0,
  );

  return (
    <div ref={ref} className={styles.fbRoot}>
      <div className={styles.fbShell}>
        <header className={styles.fbHeader}>
          <div className={styles.fbHeaderBar} />
          <div className={styles.fbHeaderInfo}>
            <p className={styles.fbOrg}>Kesses Sub-County Hospital</p>
            <h1 className={styles.fbTitle}>Final Bill</h1>
          </div>
          {bill.claim_number && (
            <div className={styles.fbMetaRight}>
              Claim No.
              <br />
              <span className={styles.fbClaimNumber}>{bill.claim_number}</span>
            </div>
          )}
        </header>

        <div className={styles.fbIdentity}>
          <div className={styles.fbField}>
            <div className={styles.fbFieldLabel}>Patient</div>
            <div className={`${styles.fbFieldValue} ${styles.fbNameValue}`}>{bill.patient_name || '—'}</div>
          </div>
          <div className={styles.fbField}>
            <div className={styles.fbFieldLabel}>Bill Date</div>
            <div className={styles.fbFieldValue}>{formatDate(bill.bill_date)}</div>
          </div>
          {bill.identifiers && (
            <div className={styles.fbField}>
              <div className={styles.fbFieldLabel}>Identifiers</div>
              <div className={styles.fbFieldValue}>{bill.identifiers}</div>
            </div>
          )}
        </div>

        <section className={styles.fbSection}>
          <h2 className={styles.fbSectionTitle}>
            <span className={styles.fbSectionNum}>1</span> Billed Items
          </h2>
          <div className={styles.fbSectionBody}>
            <table className={styles.fbTable}>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Intervention Code</th>
                  <th>Order No</th>
                  <th>Service Type</th>
                  <th>Payer</th>
                  <th>Status</th>
                  <th className={styles.fbNumCol}>Qty</th>
                  <th className={styles.fbNumCol}>Price</th>
                  <th className={styles.fbNumCol}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, i: number) => {
                  const qty = Number(item.item_quantity) || 0;
                  const price = Number(item.item_price) || 0;
                  return (
                    <tr key={i}>
                      <td className={styles.fbServiceName}>{item.billable_service || '—'}</td>
                      <td>{item.intervention_code || '—'}</td>
                      <td>{item.order_no || '—'}</td>
                      <td>{item.service_type || '—'}</td>
                      <td>{item.payment_scheme || '—'}</td>
                      <td>
                        <span className={styles.fbStatusPill}>{item.payment_status || '—'}</span>
                      </td>
                      <td className={styles.fbNumCol}>{qty}</td>
                      <td className={styles.fbNumCol}>{formatCurrency(price)}</td>
                      <td className={styles.fbNumCol}>{formatCurrency(qty * price)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={8} className={styles.fbTotalLabel}>
                    Total
                  </td>
                  <td className={styles.fbNumCol}>
                    <strong>KES {formatCurrency(total)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <div className={styles.fbFooter}>Confidential — For authorized billing use only</div>
      </div>
    </div>
  );
});

FinalBillComponent.displayName = 'FinalBillComponent';

export default FinalBillComponent;
