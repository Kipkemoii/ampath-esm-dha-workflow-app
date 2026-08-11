import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  DataTable,
  type DataTableRow,
  DataTableSkeleton,
  InlineLoading,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { launchWorkspace, navigate, showSnackbar, useSession } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import styles from './emt-queue.scss';
import EmptyState from '../billing/dashboard/v3/shared/empty-state.component';
import TableToolbar from '../billing/dashboard/v3/shared/table-toolbar.component';
import FacilityAndWorkerSlot from '../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
import { EMT_HANDOVER_WORKSPACE } from './handover-modal/handover-modal.component';
import {
  usePendingReferrals,
  EMT_PENDING_KEY,
} from './emt.resource';
import { fetchClientByCrId, clientDisplayName } from './cr-lookup.resource';
import { EmtApiError, type EmtReferralRow } from './types/emt.types';
import { searchPatientByCrNumber } from '../resources/patient-search.resource';
import { IdentifierTypesUuids } from '../resources/identifier-types';

const EmtQueue: React.FC = () => {
  const { t } = useTranslation();
  const session = useSession();
  const locationUuid = session?.sessionLocation?.uuid ?? '';
  const [searchString, setSearchString] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0); // 0-based page for server offset
  const [rows, setRows] = useState<EmtReferralRow[]>([]);
  const [globalError, setGlobalError] = useState<string>('');

  const limit = pageSize;
  const offset = pageIndex * pageSize;

  const {
    referrals,
    count,
    isLoading,
    error,
    mutate,
  } = usePendingReferrals(limit, offset, locationUuid);

  // Surface upstream errors visibly (network / auth / 5xx) with a retry path.
  useEffect(() => {
    if (!error) {
      setGlobalError('');
      return;
    }
    if (error instanceof EmtApiError) {
      const { status } = error;
      if (status === 401 || status === 403) {
        setGlobalError('Your session may have expired. Please re-authenticate and retry.');
      } else if (status >= 500 || status === 0) {
        setGlobalError('The EMT service is temporarily unavailable. Please retry.');
      } else if (status === 404) {
        setGlobalError('No pending referrals found for this facility.');
      } else {
        setGlobalError(error.message || 'Failed to load referrals.');
      }
    } else {
      setGlobalError('Unable to reach the EMT service. Please check your connection and retry.');
    }
  }, [error]);

  // Map the fetched page into display rows.
  useEffect(() => {
    const mapped: EmtReferralRow[] = (referrals ?? []).map((r) => ({
      ...r,
      patientName: r.cr_id, // placeholder until CR resolves
      crLoading: true,
    }));
    setRows(mapped);

    // Lazy CR enrichment: fetch each row's CR record in parallel. A failed
    // lookup degrades the row (keeps cr_id, marks "details unavailable")
    // rather than failing the whole queue.
    let cancelled = false;
    mapped.forEach(async (row, idx) => {
      try {
        const client = await fetchClientByCrId(row.cr_id, locationUuid);
        if (cancelled) return;
        setRows((prev) => {
          const next = [...prev];
          if (!next[idx]) return prev;
          next[idx] = {
            ...next[idx],
            client: client ?? undefined,
            patientName: clientDisplayName(client, row.cr_id),
            crLoading: false,
            crError: client ? undefined : 'Patient details unavailable',
          };
          return next;
        });
      } catch {
        if (cancelled) return;
        setRows((prev) => {
          const next = [...prev];
          if (!next[idx]) return prev;
          next[idx] = {
            ...next[idx],
            crLoading: false,
            crError: 'Patient details unavailable',
          };
          return next;
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [referrals, locationUuid]);

  const columns = [
    { id: 'patientName', header: 'Patient', key: 'patientName' },
    { id: 'crId', header: 'CR ID', key: 'crId' },
    { id: 'caseNumber', header: 'Case number', key: 'caseNumber' },
    { id: 'ambulance', header: 'Ambulance', key: 'ambulance' },
    { id: 'requestedAt', header: 'Requested', key: 'requestedAt' },
    { id: 'interventions', header: 'Interventions', key: 'interventions' },
    { id: 'notes', header: 'Referral notes', key: 'notes' },
    { id: 'status', header: 'Status', key: 'status' },
    { id: 'action', header: 'Action', key: 'action' },
    { id: 'submissionId', header: '', key: 'submissionId' }, // hidden payload carrier
  ];

  // Map each referral into a DataTable row whose `id` + keys match the columns.
  const tableRows = useMemo(
    () =>
      rows.map((r) => ({
        id: String(r.submission_id),
        patientName: r.patientName,
        crId: r.cr_id,
        caseNumber: r.case_number,
        ambulance: r.ambulance_fr_code,
        requestedAt: r.requested_at,
        interventions: (r.interventions ?? []).join(', '),
        notes: r.referral_notes,
        status: r.status,
        action: String(r.submission_id),
        submissionId: String(r.submission_id),
      })),
    [rows],
  );

  // Sort newest first, then apply the client-side search filter.
  const visibleRows = useMemo(() => {
    const sorted = [...tableRows].sort(
      (a, b) => dayjs(b.requestedAt).valueOf() - dayjs(a.requestedAt).valueOf(),
    );
    if (!searchString.trim()) return sorted;
    const q = searchString.toLowerCase();
    return sorted.filter(
      (r) =>
        r.patientName?.toLowerCase().includes(q) ||
        r.crId?.toLowerCase().includes(q) ||
        r.caseNumber?.toLowerCase().includes(q) ||
        r.ambulance?.toLowerCase().includes(q),
    );
  }, [tableRows, searchString]);

  // Lookup of raw referral rows by submission id, so cell renderers can read
  // enriched fields (interventions, notes, crLoading, crError) directly.
  const rowsById = useMemo(
    () => new Map(rows.map((r) => [String(r.submission_id), r])),
    [rows],
  );

  const showSkeleton = isLoading && rows.length === 0;

  const relativeTime = (iso: string) => {
    const mins = dayjs().diff(dayjs(iso), 'minute');
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem ? `${hrs}h ${rem}m ago` : `${hrs}h ago`;
  };

  const handleRefresh = async () => {
    try {
      await mutate();
    } catch {
      showSnackbar({ kind: 'error', title: 'Refresh failed', subtitle: '' });
    }
  };

  const handleHandoverComplete = async (referral: EmtReferralRow) => {
    // Refresh from the source of truth — don't just splice locally.
    mutate();
    showSnackbar({
      kind: 'success',
      title: 'Handover complete',
      subtitle: `Starting visit for ${referral.patientName} (${referral.case_number}).`,
    });
    // EmtQueue is mounted as a bare extension (no React Router ancestor), so
    // cross-app navigation has to go through the shell's navigate() rather
    // than react-router's useNavigate — and there's no router `state` channel
    // either.
    //
    // If the patient already exists in AMRS (registered on an earlier visit),
    // skip straight to their chart. Otherwise fall back to the registry
    // screen so staff complete registration manually, same as today — the CR
    // id travels via a query param and the Registration screen re-resolves
    // the CR record itself.
    let amrsPatientUuid: string | undefined;
    try {
      const resp = await searchPatientByCrNumber(referral.cr_id);
      amrsPatientUuid = (resp.results ?? []).find((p) =>
        p.identifiers.some(
          (id) =>
            id.identifier === referral.cr_id &&
            id.identifierType.uuid === IdentifierTypesUuids.CLIENT_REGISTRY_NO_UUID,
        ),
      )?.uuid;
    } catch {
      // Registration-status check failed — fall back to the manual registry path below.
    }

    navigate({
      to: amrsPatientUuid
        ? `\${openmrsSpaBase}/patient/${amrsPatientUuid}/chart`
        : `\${openmrsSpaBase}/home/registry?emtCrId=${encodeURIComponent(referral.cr_id)}`,
    });
  };

  // The backend returned 404 during initiate/verify — another facility/user
  // already handled this referral, or it no longer exists.
  const handleReferralUnavailable = (referral: EmtReferralRow, reason: string) => {
    mutate();
    showSnackbar({
      kind: 'warning',
      title: 'Referral no longer available',
      subtitle:
        reason ||
        `${referral.patientName || referral.cr_id} (${referral.case_number}) could not be found — it may have already been handled.`,
    });
  };

  const openHandover = (row: DataTableRow<any[]>) => {
    const target = rowsById.get(String(row.id));
    if (!target) return;
    if (!locationUuid) {
      showSnackbar({ kind: 'error', title: 'No default location selected', subtitle: '' });
      return;
    }
    launchWorkspace(EMT_HANDOVER_WORKSPACE, {
      workspaceTitle: 'EMT Handover',
      referral: target,
      locationUuid,
      onHandoverComplete: handleHandoverComplete,
      onReferralUnavailable: handleReferralUnavailable,
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <FacilityAndWorkerSlot />
      </div>

      <div className={styles.toolbarRow}>
        <div>
          <h3 className={styles.title}>EMT / Referral</h3>
          <p className={styles.subtitle}>
            Incoming ambulance and EMT referrals awaiting handover.
          </p>
        </div>
        <Button kind="tertiary" onClick={handleRefresh} disabled={isLoading}>
          {isLoading ? <InlineLoading description="Refreshing…" /> : 'Refresh'}
        </Button>
      </div>

      {globalError && (
        <div className={styles.errorBanner} role="alert">
          <span>{globalError}</span>
          <Button size="sm" kind="ghost" onClick={handleRefresh}>
            Retry
          </Button>
        </div>
      )}

      {showSkeleton ? (
        <div className={styles.tableCard}>
          <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} />
        </div>
      ) : rows.length === 0 && !globalError ? (
        <div className={styles.tableCard}>
          <EmptyState message="No pending EMT referrals for your facility." />
        </div>
      ) : (
        <>
          <TableToolbar
            id="emt-queue"
            search={searchString}
            onSearch={setSearchString}
            searchPlaceholder={t('searchThisList', 'Search this list')}
          />
          {visibleRows.length === 0 ? (
            <div className={styles.tableCard}>
              <EmptyState message="No referrals match your search." />
            </div>
          ) : (
            <DataTable rows={visibleRows} headers={columns}>
              {({ rows: tableRows, headers, getTableProps, getHeaderProps, getRowProps, getCellProps }) => (
                <div className={styles.tableCard}>
                  <Table size="sm" useZebraStyles aria-label="EMT referrals" {...getTableProps()}>
                    <TableHead>
                      <TableRow>
                        {headers
                          .filter((h) => h.key !== 'submissionId')
                          .map((header) => (
                            <TableHeader {...getHeaderProps({ header })}>{header.header}</TableHeader>
                          ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tableRows.map((row) => {
                        const dataRow = rowsById.get(String(row.id));
                        return (
                          <TableRow {...getRowProps({ row })}>
                            {row.cells.map((cell) => {
                              if (cell.info.header === 'submissionId') return null;

                              if (cell.info.header === 'patientName') {
                                return (
                                  <TableCell key={cell.id}>
                                    <div className={styles.patientCell}>
                                      <span>{cell.value}</span>
                                      {dataRow?.crLoading && (
                                        <InlineLoading description="…" />
                                      )}
                                      {dataRow?.crError && (
                                        <span className={styles.muted}> ({dataRow.crError})</span>
                                      )}
                                    </div>
                                  </TableCell>
                                );
                              }
                              if (cell.info.header === 'interventions') {
                                const list = dataRow?.interventions ?? [];
                                return (
                                  <TableCell key={cell.id}>
                                    {list.length ? (
                                      list.map((iv) => (
                                        <Tag key={iv} size="sm" type="gray">
                                          {iv}
                                        </Tag>
                                      ))
                                    ) : (
                                      '—'
                                    )}
                                  </TableCell>
                                );
                              }
                              if (cell.info.header === 'notes') {
                                const notes = dataRow?.referral_notes ?? '';
                                return (
                                  <TableCell key={cell.id} className={styles.notesCell} title={notes}>
                                    {notes ? `${notes.slice(0, 60)}${notes.length > 60 ? '…' : ''}` : '—'}
                                  </TableCell>
                                );
                              }
                              if (cell.info.header === 'requestedAt') {
                                return (
                                  <TableCell key={cell.id}>
                                    <div className={styles.timeCell}>
                                      <span>{relativeTime(dataRow?.requested_at)}</span>
                                      <span className={styles.muted}>
                                        {dataRow?.requested_at
                                          ? dayjs(dataRow.requested_at).format('DD MMM, HH:mm')
                                          : ''}
                                      </span>
                                    </div>
                                  </TableCell>
                                );
                              }
                              if (cell.info.header === 'status') {
                                return (
                                  <TableCell key={cell.id}>
                                    <Tag size="sm" type="warm-gray">
                                      {dataRow?.status ?? 'pending'}
                                    </Tag>
                                  </TableCell>
                                );
                              }
                              if (cell.info.header === 'action') {
                                return (
                                  <TableCell key={cell.id} className={styles.actionCell}>
                                    <Button kind="tertiary" size="sm" onClick={() => openHandover(row)}>
                                      Handover
                                    </Button>
                                  </TableCell>
                                );
                              }
                              return (
                                <TableCell key={cell.id} {...getCellProps({ cell })}>
                                  {cell.value}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </DataTable>
          )}
          {visibleRows.length > 0 && (
            <Pagination
              forwardText={t('nextPage', 'Next page')}
              backwardText={t('previousPage', 'Previous page')}
              page={pageIndex + 1}
              pageSize={pageSize}
              pageSizes={[10, 20, 30, 40, 50]}
              totalItems={count}
              onChange={({ pageSize: ps, page }) => {
                if (ps !== pageSize) {
                  setPageSize(ps);
                  setPageIndex(0);
                } else {
                  setPageIndex(page - 1);
                }
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

export default EmtQueue;
export { EMT_PENDING_KEY };
