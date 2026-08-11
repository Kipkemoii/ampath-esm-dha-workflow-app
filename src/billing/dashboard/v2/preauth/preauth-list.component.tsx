import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  DataTableSkeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { Renew } from '@carbon/react/icons';
import { showSnackbar } from '@openmrs/esm-framework';
import {
  checkPreauthStatus,
  getPreauthPreview,
  readPreauthCheck,
  type PreauthCheckKind,
} from '../../../../claims/claims.resource';
import EmptyState from '../shared/empty-state.component';
import TableToolbar from '../shared/table-toolbar.component';
import { type PatientFacilityBillDetails } from '../types';
import styles from './preauth-list.component.scss';
import {
  fetchActiveVisitForPatient,
  fetchPreauthBillItems,
  interventionFlagsFromBillItem,
  needsElectivePreauth,
  preauthFormLabel,
  resolveConsentTokenForVisit,
} from './preauth.resource';
import PreauthStatusTag, { type PreauthStatusDisplayKind } from './preauth-status-tag.component';

interface PreauthListProps {
  locationUuid: string;
  billingDate: string;
  onDateChange?: (value: string) => void;
}

type RowMeta = {
  kind: PreauthStatusDisplayKind;
  status?: string;
  preauthCode?: string;
  notes?: string;
};

/**
 * Preauthorizations → Needs raise queue (read-only).
 * Raise preauth is only available from facility bill details (claim intervention cards).
 */
const PreauthList: React.FC<PreauthListProps> = ({ locationUuid, billingDate, onDateChange }) => {
  const [items, setItems] = useState<PatientFacilityBillDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [rowMeta, setRowMeta] = useState<Record<string, RowMeta>>({});

  const rowKey = (item: PatientFacilityBillDetails) =>
    `${item.patient_uuid}-${item.intervention_code}-${item.order_no ?? item.bill_line_item_id ?? item.cashier_bill_line_item_uuid}`;

  // `force` skips the short cache that stops the several places reading /pre-auth/preview
  // from each paying for the same call. Refresh, and the reload after a preauth is raised,
  // are asking for the current answer, so they go to the HIE.
  const load = useCallback(
    async (force = false) => {
      if (!locationUuid || !billingDate) return;
      setLoading(true);
      try {
        const data = await fetchPreauthBillItems(locationUuid, billingDate);
        setItems(data);

        const metaMap: Record<string, RowMeta> = {};
        // One preview per visit, not per row. A visit's bill rows share its consent token and
        // the preview covers every intervention on it, so asking once and reading each row's
        // intervention off the answer replaces a call per row — a patient with five
        // interventions was five identical requests to a rate-limited HIE endpoint.
        const previewByToken = new Map<string, unknown>();
        const previewFor = async (token: string) => {
          if (!previewByToken.has(token)) {
            previewByToken.set(token, await getPreauthPreview(token, locationUuid, { force }));
          }
          return previewByToken.get(token);
        };

        for (const item of data) {
          const key = rowKey(item);
          try {
            const visit = await fetchActiveVisitForPatient(item.patient_uuid, locationUuid);
            const token = resolveConsentTokenForVisit(visit) || item.consent_token || '';
            if (!token) {
              metaMap[key] = { kind: 'no_token' };
              continue;
            }
            metaMap[key] = { kind: 'loading' };

            const check = readPreauthCheck(await previewFor(token), item.intervention_code);
            metaMap[key] = {
              kind: check.kind as PreauthCheckKind,
              status: check.status,
              preauthCode: check.preauthCode,
              notes: check.notes,
            };
          } catch {
            const token = item.consent_token || '';
            if (token) {
              const check = await checkPreauthStatus(token, locationUuid, item.intervention_code);
              metaMap[key] = {
                kind: check.kind as PreauthCheckKind,
                status: check.status,
                preauthCode: check.preauthCode,
                notes: check.notes,
              };
            } else {
              metaMap[key] = { kind: 'error', status: 'Visit lookup failed' };
            }
          }
        }
        setRowMeta(metaMap);
      } catch {
        showSnackbar({
          kind: 'error',
          title: 'Error loading preauth items',
          subtitle: 'Could not load bill items needing preauth. Reload or contact support.',
        });
        setItems([]);
        setRowMeta({});
      } finally {
        setLoading(false);
      }
    },
    [locationUuid, billingDate],
  );

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((item) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return `${item.patient_name} ${item.intervention_code} ${item.billable_service}`.toLowerCase().includes(term);
  });

  const stillNeedsRaise = (item: PatientFacilityBillDetails, meta: RowMeta | undefined) => {
    const elective = needsElectivePreauth(item);
    return meta?.kind === 'not_raised' || meta?.kind === 'failed' || (elective && meta?.kind === 'no_token');
  };

  // Queue of interventions that still need a preauth — raise from facility bill details.
  const needsRaiseRows = filtered.filter((item) => {
    const meta = rowMeta[rowKey(item)];
    if (!meta || meta.kind === 'loading') return false;
    return stillNeedsRaise(item, meta);
  });

  return (
    <div className={styles.preauthList}>
      <p className={styles.muted}>
        Interventions that still need preauth. Open the patient under Facility bills to raise from Claim details.
      </p>
      <div className={styles.toolbarRow}>
        <TableToolbar
          id="preauth-list"
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search patient or intervention…"
          onDate={onDateChange}
        />
        <Button
          kind="ghost"
          size="md"
          renderIcon={Renew}
          iconDescription="Refresh preauth status"
          hasIconOnly
          disabled={loading}
          onClick={() => load(true)}
          className={styles.refreshBtn}
        />
      </div>
      {loading ? (
        <DataTableSkeleton showHeader={false} rowCount={5} />
      ) : items.length === 0 ? (
        <EmptyState message="No bill items needing preauth for this date." />
      ) : filtered.length === 0 ? (
        <EmptyState message="No items match your search." />
      ) : needsRaiseRows.length === 0 ? (
        <EmptyState message="No items left to raise. Check Status for in-flight or clarified preauths." />
      ) : (
        <Table aria-label="Preauth bill items" size="sm">
          <TableHead>
            <TableRow>
              <TableHeader>Patient</TableHeader>
              <TableHeader>Intervention</TableHeader>
              <TableHeader>Order</TableHeader>
              <TableHeader>Form</TableHeader>
              <TableHeader>Bill status</TableHeader>
              <TableHeader>Preauth</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {needsRaiseRows.map((item) => {
              const key = rowKey(item);
              const flags = interventionFlagsFromBillItem(item);
              const meta = rowMeta[key];
              const elective = needsElectivePreauth(item);
              return (
                <TableRow key={key}>
                  <TableCell>
                    <div>{item.patient_name}</div>
                    <div className={styles.muted}>{item.cr_no}</div>
                  </TableCell>
                  <TableCell>
                    <div>{item.intervention_code}</div>
                    <div className={styles.muted}>{item.service_type || item.billable_service}</div>
                  </TableCell>
                  <TableCell>{item.order_no ?? '—'}</TableCell>
                  <TableCell>
                    <Tag size="sm" type={elective ? 'magenta' : 'blue'}>
                      {elective ? 'Elective' : preauthFormLabel(flags)}
                    </Tag>
                  </TableCell>
                  <TableCell>{item.status ?? item.paid_status ?? '—'}</TableCell>
                  <TableCell>
                    <PreauthStatusTag
                      kind={meta?.kind}
                      status={meta?.status}
                      preauthCode={meta?.preauthCode}
                      loading={!meta || meta.kind === 'loading'}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default PreauthList;
