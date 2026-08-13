import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  DataTableSkeleton,
  OverflowMenu,
  OverflowMenuItem,
  Search,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { Renew } from '@carbon/react/icons';
import { launchWorkspace, showSnackbar, useConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import {
  fetchShaInterventionByCode,
  isPreauthFinalised,
  isPreauthResubmittable,
  patchPreAuthRequest,
} from '../../../../../claims/claims.resource';
import type { ConfigObject } from '../../../../../config-schema';
import EmptyState from '../../shared/empty-state.component';
import {
  enrichElectiveHolds,
  fetchElectiveHolds,
  syncElectiveHoldStatusesFromPreview,
  type ElectiveHoldRow,
} from './elective-preauth.resource';
import styles from '../preauth-list.component.scss';

interface ElectiveRequestsListProps {
  locationUuid: string;
}

type HoldActionKind = 'raise' | 'resubmit' | 'none';

function normalizeStatus(status: string | null | undefined): string {
  return String(status ?? '').trim().toUpperCase();
}

function statusTagType(status: string): 'green' | 'blue' | 'teal' | 'red' | 'purple' | 'gray' {
  const s = normalizeStatus(status);
  if (s === 'ACTIVE' || isPreauthFinalised(s)) return 'green';
  if (s === 'PENDING' || !s) return 'blue';
  if (isPreauthResubmittable(s)) return s.includes('CLARIFICATION') ? 'purple' : 'red';
  return 'teal';
}

/** Display / action status: HIE preview only when the hold has a consent token. */
function displayStatusForRow(row: ElectiveHoldRow, hieStatus?: string): string {
  // Request-only (not raised) — never show a synced HIE status.
  if (!row.consentToken?.trim()) {
    return 'PENDING';
  }
  return normalizeStatus(hieStatus || row.status) || 'PENDING';
}

function actionForHold(row: ElectiveHoldRow, hieStatus?: string): HoldActionKind {
  // Not raised yet — no consent token.
  if (!row.consentToken?.trim()) return 'raise';

  const effective = displayStatusForRow(row, hieStatus);
  if (isPreauthResubmittable(effective)) return 'resubmit';
  if (!effective || effective === 'PENDING') return 'raise';
  return 'none';
}

const ElectiveRequestsList: React.FC<ElectiveRequestsListProps> = ({ locationUuid }) => {
  const config = useConfig<ConfigObject>();
  const [items, setItems] = useState<ElectiveHoldRow[]>([]);
  const [hieStatusById, setHieStatusById] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!locationUuid) return;
    setLoading(true);
    try {
      const rows = await fetchElectiveHolds({ locationUuid });
      const enriched = await enrichElectiveHolds(
        rows,
        config.electivePreauth?.clientRegistryIdentifierTypeUuid,
      );

      // Status check / patch ONLY for holds that already have a consent token (raised).
      const raised = enriched.filter((row) => Boolean(row.consentToken?.trim()));
      const statusMap =
        raised.length > 0
          ? await syncElectiveHoldStatusesFromPreview(raised, locationUuid)
          : {};

      setHieStatusById(statusMap);
      setItems(
        enriched.map((row) => {
          if (!row.consentToken?.trim()) return row;
          return statusMap[row.id] ? { ...row, status: statusMap[row.id] } : row;
        }),
      );
    } catch (e) {
      showSnackbar({
        title: 'Elective requests',
        subtitle: e instanceof Error ? e.message : 'Failed to load elective holds',
        kind: 'error',
      });
      setItems([]);
      setHieStatusById({});
    } finally {
      setLoading(false);
    }
  }, [locationUuid, config.electivePreauth?.clientRegistryIdentifierTypeUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = items.filter((row) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      row.patientName.toLowerCase().includes(q) ||
      row.patientUuid.toLowerCase().includes(q) ||
      row.interventionCode.toLowerCase().includes(q) ||
      (row.orderNo ?? '').toLowerCase().includes(q) ||
      row.providerDisplay.toLowerCase().includes(q) ||
      row.crNo.toLowerCase().includes(q)
    );
  });

  const openRaiseWorkspace = async (row: ElectiveHoldRow, mode: 'raise' | 'resubmit') => {
    setBusyId(row.id);
    try {
      let intervention = {
        code: row.interventionCode,
        name: row.interventionCode,
        requiresSurgicalPreauth: false,
        requiresRenalPreauth: false,
        requiresOncologyPreauth: false,
        requiresRadiologyPreauth: false,
        requiresOpticalPreauth: false,
        requiredPreauthDocumentTypes: (row.requiredPreauthDocumentTypes || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        applicableDocumentTypes: (row.applicableDocumentTypes || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };

      if (row.crNo) {
        try {
          const coverage = await fetchShaInterventionByCode(
            row.crNo,
            row.locationUuid || locationUuid,
            row.interventionCode,
          );
          if (coverage) {
            intervention = {
              ...intervention,
              code: coverage.code || row.interventionCode,
              name: coverage.name || row.interventionCode,
              requiresSurgicalPreauth: Boolean(coverage.requiresSurgicalPreauth),
              requiresRenalPreauth: Boolean(coverage.requiresRenalPreauth),
              requiresOncologyPreauth: Boolean(coverage.requiresOncologyPreauth),
              requiresRadiologyPreauth: Boolean(coverage.requiresRadiologyPreauth),
              requiresOpticalPreauth: Boolean(coverage.requiresOpticalPreauth),
              requiredPreauthDocumentTypes:
                coverage.requiredPreauthDocumentTypes ?? intervention.requiredPreauthDocumentTypes,
              applicableDocumentTypes:
                coverage.applicableDocumentTypes ?? intervention.applicableDocumentTypes,
            };
          }
        } catch {
          // keep hold-derived intervention
        }
      }

      launchWorkspace('preauth-form-workspace', {
        consentToken: row.consentToken || '',
        patientUuid: row.patientUuid,
        locationUuid: row.locationUuid || locationUuid,
        isElective: true,
        encounterUuid: row.encounterUuid || undefined,
        initialExpectedServiceStartDate: row.expectedServiceStartDate || undefined,
        initialDoctorNationalId: row.providerNationalId || undefined,
        initialProviderDisplay: row.providerDisplay || undefined,
        billItem: {
          intervention_code: row.interventionCode,
          patient_uuid: row.patientUuid,
          patient_name: row.patientName,
          cr_no: row.crNo,
          service_type: row.serviceType,
          order_no: row.orderNo,
          sub_benefit_code: row.subBenefitCode,
          billable_service: intervention.name,
        },
        intervention,
        onSuccess: async (result: { consentToken?: string; status: string }) => {
          try {
            await patchPreAuthRequest(row.id, {
              ...(result.consentToken?.trim()
                ? { consentToken: result.consentToken.trim() }
                : {}),
              status: result.status || 'PENDING_DOCTOR_APPROVAL',
            });
            showSnackbar({
              title: mode === 'resubmit' ? 'Elective preauth resubmitted' : 'Elective preauth raised',
              subtitle: result.consentToken?.trim()
                ? `Hold #${row.id} updated with consent token`
                : `Hold #${row.id} updated`,
              kind: 'success',
            });
            void load();
          } catch (e) {
            showSnackbar({
              title: 'Hold update failed',
              subtitle:
                e instanceof Error
                  ? e.message
                  : 'Preauth may have been submitted; refresh Status tab',
              kind: 'warning',
            });
          } finally {
            setBusyId(null);
          }
        },
      });
    } catch (e) {
      showSnackbar({
        title: mode === 'resubmit' ? 'Could not open Resubmit' : 'Could not open Raise',
        subtitle: e instanceof Error ? e.message : String(e),
        kind: 'error',
      });
    } finally {
      setTimeout(() => setBusyId(null), 2000);
    }
  };

  if (loading && items.length === 0) {
    return <DataTableSkeleton />;
  }

  return (
    <div className={styles.preauthList}>
      <div className={styles.toolbarRow}>
        <Search
          id="elective-requests-search"
          size="md"
          labelText="Search"
          placeholder="Search patient, provider, intervention…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
        <Button
          className={styles.refreshBtn}
          kind="ghost"
          size="sm"
          renderIcon={Renew}
          onClick={() => void load()}
        >
          Refresh
        </Button>
      </div>
      {filtered.length === 0 ? (
        <EmptyState message="No elective preauth requests for this facility." />
      ) : (
        <Table size="sm" useZebraStyles>
          <TableHead>
            <TableRow>
              <TableHeader>Patient</TableHeader>
              <TableHeader>Provider</TableHeader>
              <TableHeader>Intervention</TableHeader>
              <TableHeader>Expected service</TableHeader>
              <TableHeader>Encounter</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader />
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((row) => {
              const hieStatus = hieStatusById[row.id];
              const displayStatus = displayStatusForRow(row, hieStatus);
              const action = actionForHold(row, hieStatus);

              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <div>{row.patientName || '—'}</div>
                    {row.crNo ? <div className={styles.muted}>CR {row.crNo}</div> : null}
                  </TableCell>
                  <TableCell>
                    <div>{row.providerDisplay || '—'}</div>
                    {row.providerNationalId ? (
                      <div className={styles.muted}>ID {row.providerNationalId}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div>{row.interventionCode}</div>
                    {row.clinicalIndications ? (
                      <div className={styles.notes}>{row.clinicalIndications}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {row.expectedServiceStartDate
                      ? dayjs(row.expectedServiceStartDate).format('DD MMM YYYY')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {row.encounterDatetime
                      ? dayjs(row.encounterDatetime).format('DD MMM YYYY HH:mm')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Tag type={statusTagType(displayStatus)}>{displayStatus}</Tag>
                  </TableCell>
                  <TableCell>
                    {action === 'none' ? (
                      <span className={styles.muted}>—</span>
                    ) : (
                      <OverflowMenu
                        ariaLabel={`Actions for ${row.interventionCode}`}
                        flipped
                        size="sm"
                        disabled={busyId === row.id}
                      >
                        {action === 'raise' ? (
                          <OverflowMenuItem
                            itemText="Raise preauth"
                            onClick={() => void openRaiseWorkspace(row, 'raise')}
                          />
                        ) : null}
                        {action === 'resubmit' ? (
                          <OverflowMenuItem
                            itemText="Resubmit preauth"
                            onClick={() => void openRaiseWorkspace(row, 'resubmit')}
                          />
                        ) : null}
                      </OverflowMenu>
                    )}
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

export default ElectiveRequestsList;
