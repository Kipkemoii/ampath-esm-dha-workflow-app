import React, { forwardRef } from 'react';
import { type VisitIntervention } from '../../types';
import styles from './invoice.scss';
import { useSession } from '@openmrs/esm-framework';

interface InvoiceComponentProps {
  bill?: any;
  patientUuid?: any;
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

const InvoiceComponent = forwardRef<HTMLDivElement, InvoiceComponentProps>(({ bill }, ref) => {
  const session = useSession();
  const locationUuid = session?.sessionLocation?.uuid;
  if (!bill) {
    return (
      <div ref={ref} className={styles.invRoot}>
        <div className={styles.invEmpty}>No invoice data available.</div>
      </div>
    );
  }

  const items =
    Array.isArray(bill.items) && bill.items.length > 0
      ? bill.items
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
    <div ref={ref} className={styles.invRoot}>
      <div className={styles.invShell}>
        <header className={styles.invHeader}>
          <div className={styles.invHeaderBar} />
          <div className={styles.invHeaderInfo}>
            <p className={styles.invOrg}>Kesses Sub-County Hospital</p>
            <h1 className={styles.invTitle}>Invoice</h1>
          </div>
          {bill.claim_number && (
            <div className={styles.invMetaRight}>
              Claim No.
              <br />
              <span className={styles.invClaimNumber}>{bill.claim_number}</span>
            </div>
          )}
        </header>

        <div className={styles.invIdentity}>
          <div className={styles.invField}>
            <div className={styles.invFieldLabel}>Patient</div>
            <div className={`${styles.invFieldValue} ${styles.invNameValue}`}>{bill.patient_name || '—'}</div>
          </div>
          <div className={styles.invField}>
            <div className={styles.invFieldLabel}>Invoice Date</div>
            <div className={styles.invFieldValue}>{formatDate(bill.bill_date)}</div>
          </div>
          {bill.identifiers && (
            <div className={styles.invField}>
              <div className={styles.invFieldLabel}>Identifiers</div>
              <div className={styles.invFieldValue}>{bill.identifiers}</div>
            </div>
          )}
        </div>

        <section className={styles.invSection}>
          <h2 className={styles.invSectionTitle}>
            <span className={styles.invSectionNum}>1</span> Billed Items
          </h2>
          <div className={styles.invSectionBody}>
            <table className={styles.invTable}>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Intervention Code</th>
                  <th>Order No</th>
                  <th>Service Type</th>
                  <th>Payer</th>
                  <th>Status</th>
                  <th className={styles.invNumCol}>Qty</th>
                  <th className={styles.invNumCol}>Price</th>
                  <th className={styles.invNumCol}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, i: number) => {
                  const qty = Number(item.item_quantity) || 0;
                  const price = Number(item.item_price) || 0;
                  return (
                    <tr key={i}>
                      <td className={styles.invServiceName}>{item.billable_service || '—'}</td>
                      <td>{item.intervention_code || '—'}</td>
                      <td>{item.order_no || '—'}</td>
                      <td>{item.service_type || '—'}</td>
                      <td>{item.payment_scheme || '—'}</td>
                      <td>
                        <span className={styles.invStatusPill}>{item.payment_status || '—'}</span>
                      </td>
                      <td className={styles.invNumCol}>{qty}</td>
                      <td className={styles.invNumCol}>{formatCurrency(price)}</td>
                      <td className={styles.invNumCol}>{formatCurrency(qty * price)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={8} className={styles.invTotalLabel}>
                    Total
                  </td>
                  <td className={styles.invNumCol}>
                    <strong>KES {formatCurrency(total)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <div className={styles.invFooter}>Confidential — For authorized billing use only</div>
      </div>
    </div>
  );
});

InvoiceComponent.displayName = 'InvoiceComponent';

export default InvoiceComponent;
