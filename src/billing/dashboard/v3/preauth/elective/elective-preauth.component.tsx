import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  DataTable,
  DataTableSkeleton,
  InlineLoading,
  OverflowMenu,
  OverflowMenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { launchWorkspace2, showSnackbar, useConfig, usePatient, useSession } from '@openmrs/esm-framework';
import { CardHeader, EmptyState } from '@openmrs/esm-patient-common-lib';
import dayjs from 'dayjs';
import { isPreauthFinalised, patchPreAuthRequest } from '../../../../../claims/claims.resource';
import type { ConfigObject } from '../../../../../config-schema';
import { getReadableErrorMessage } from '../../../../../registry/utils/error-handler';
import { fetchActiveVisitForPatient } from '../preauth.resource';
import {
  createElectiveServiceOrder,
  fetchPreauthEncounterCards,
  resolveElectiveServiceConceptUuid,
  syncElectiveHoldStatusesFromPreview,
  type PreauthEncounterCard,
} from './elective-preauth.resource';
import styles from './elective-preauth.component.scss';

const HEADERS = [
  { key: 'date', header: 'Date' },
  { key: 'intervention', header: 'Intervention' },
  { key: 'expectedService', header: 'Expected service' },
  { key: 'status', header: 'Status' },
  { key: 'orderNo', header: 'Order #' },
  { key: 'indications', header: 'Clinical indications' },
  { key: 'actions', header: 'Actions' },
];

function normalizeStatus(status: string | null | undefined): string {
  return String(status ?? '').trim().toUpperCase();
}

/** Create Order is allowed once HIE has accepted the preauth (ACTIVE or FINALISED). */
function canCreateOrderForStatus(status: string | null | undefined): boolean {
  const s = normalizeStatus(status);
  return s === 'ACTIVE' || isPreauthFinalised(s);
}

function statusTagType(status: string): 'green' | 'blue' | 'teal' | 'red' | 'purple' {
  const s = normalizeStatus(status);
  if (s === 'ACTIVE' || isPreauthFinalised(s)) return 'green';
  if (s === 'PENDING') return 'blue';
  if (s.includes('REJECT') || s.includes('FAIL') || s.includes('CANCEL')) return 'red';
  if (s.includes('CLARIFICATION')) return 'purple';
  return 'teal';
}

function displayOrderNo(orderNo: string | null | undefined): string {
  const raw = String(orderNo ?? '').trim();
  if (!raw) return '—';
  // Hide internal concept encoding until a real order number is written.
  if (raw.startsWith('ELECTIVE-') && raw.includes('::')) return '—';
  if (raw.startsWith('ELECTIVE-')) return '—';
  return raw;
}

const ElectivePreauthExtension: React.FC = () => {
  const { patient, isLoading: patientLoading } = usePatient();
  const session = useSession();
  const config = useConfig<ConfigObject>();
  const electiveCfg = config.electivePreauth;

  const patientUuid = patient?.id ?? '';
  const locationUuid = session?.sessionLocation?.uuid ?? '';
  const providerUuid = session?.currentProvider?.uuid ?? '';

  const [cards, setCards] = useState<PreauthEncounterCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [hieStatusByHoldId, setHieStatusByHoldId] = useState<Record<number, string>>({});
  const [creatingOrderFor, setCreatingOrderFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!patientUuid) return;
    setLoading(true);
    try {
      const list = await fetchPreauthEncounterCards(
        patientUuid,
        electiveCfg?.encounterTypeUuid,
        locationUuid,
      );
      setCards(list);

      // Only preview / update status for holds that already have a consent token.
      const raised = list
        .map((card) => card.hold)
        .filter(
          (h): h is NonNullable<typeof h> =>
            Boolean(h?.id) && Boolean(String(h?.consentToken ?? '').trim()),
        );
      const statusMap =
        locationUuid && raised.length > 0
          ? await syncElectiveHoldStatusesFromPreview(raised, locationUuid)
          : {};
      setHieStatusByHoldId(statusMap);
    } catch (e) {
      showSnackbar({
        title: 'Elective preauth',
        subtitle: e instanceof Error ? e.message : 'Failed to load preauth encounters',
        kind: 'error',
      });
      setCards([]);
      setHieStatusByHoldId({});
    } finally {
      setLoading(false);
    }
  }, [patientUuid, locationUuid, electiveCfg?.encounterTypeUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  const openRequestWorkspace = useCallback(async () => {
    if (!patientUuid) {
      showSnackbar({
        title: 'Patient not loaded',
        subtitle: 'Wait for the patient chart to finish loading, then try again.',
        kind: 'error',
      });
      return;
    }

    try {
      await launchWorkspace2('elective-preauth-request-workspace', {
        patientUuid,
        onSuccess: () => void load(),
      });
    } catch (error) {
      console.error(error);
      showSnackbar({
        title: 'Could not open workspace',
        subtitle: error instanceof Error ? error.message : String(error),
        kind: 'error',
      });
    }
  }, [patientUuid, load]);

  const openEditWorkspace = useCallback(
    async (card: PreauthEncounterCard) => {
      if (!patientUuid) return;
      try {
        await launchWorkspace2('elective-preauth-request-workspace', {
          patientUuid,
          encounterUuid: card.uuid,
          holdId: card.hold?.id,
          onSuccess: () => void load(),
        });
      } catch (error) {
        console.error(error);
        showSnackbar({
          title: 'Could not open edit workspace',
          subtitle: error instanceof Error ? error.message : String(error),
          kind: 'error',
        });
      }
    },
    [patientUuid, load],
  );

  const effectiveStatus = useCallback(
    (card: PreauthEncounterCard): string => {
      const hold = card.hold;
      if (!hold) return '';
      // No consent token → request only; do not use HIE / stale synced status.
      if (!hold.consentToken?.trim()) {
        return 'PENDING';
      }
      const fromHie = hold.id != null ? hieStatusByHoldId[hold.id] : '';
      if (fromHie) return fromHie;
      if (!hold.status?.trim()) return 'SUBMITTED';
      return String(hold.status).trim();
    },
    [hieStatusByHoldId],
  );

  const onCreateOrder = useCallback(
    async (card: PreauthEncounterCard) => {
      const hold = card.hold;
      if (!hold?.id) {
        showSnackbar({
          title: 'Missing hold',
          subtitle: 'This encounter has no elective preauth hold to update.',
          kind: 'error',
        });
        return;
      }
      if (!providerUuid) {
        showSnackbar({
          title: 'Missing provider',
          subtitle: 'Log in as a provider user to create the order.',
          kind: 'error',
        });
        return;
      }

      setCreatingOrderFor(card.uuid);
      try {
        const visit = await fetchActiveVisitForPatient(patientUuid, locationUuid);
        if (!visit?.uuid) {
          showSnackbar({
            title: 'No active visit',
            subtitle: 'Start (or continue) an active visit for this patient, then create the order.',
            kind: 'error',
          });
          return;
        }

        const conceptUuid =
          card.plannedServiceConceptUuid ||
          (await resolveElectiveServiceConceptUuid({
            orderNo: hold.orderNo,
            interventionCode: hold.interventionCode,
          }));
        if (!conceptUuid) {
          showSnackbar({
            title: 'Missing service concept',
            subtitle:
              'Could not resolve the planned service concept from the elective request. Recapture the request or check SHA mappings.',
            kind: 'error',
          });
          return;
        }

        const { orderNumber } = await createElectiveServiceOrder({
          patientUuid,
          visitUuid: visit.uuid,
          locationUuid,
          providerUuid,
          conceptUuid,
          orderEncounterTypeUuid: config.orderEncounterTypeUuid ?? '',
          outPatientCareSettingUuid: config.outPatientCareSettingUuid ?? '',
        });

        await patchPreAuthRequest(hold.id, { orderNo: orderNumber });

        showSnackbar({
          title: 'Order created',
          subtitle: `Order ${orderNumber} linked to elective preauth hold #${hold.id}`,
          kind: 'success',
        });
        await load();
      } catch (e) {
        showSnackbar({
          title: 'Create order failed',
          subtitle: getReadableErrorMessage(
            e,
            e instanceof Error ? e.message : 'Could not create the order. Check the planned service concept.',
          ),
          kind: 'error',
        });
      } finally {
        setCreatingOrderFor(null);
      }
    },
    [patientUuid, locationUuid, providerUuid, config, load],
  );

  const tableRows = useMemo(
    () =>
      cards.map((card) => {
        const status = effectiveStatus(card);
        const hasRealOrder = displayOrderNo(card.hold?.orderNo) !== '—';
        const showCreateOrder =
          canCreateOrderForStatus(status) && Boolean(card.hold?.id) && !hasRealOrder;
        const busy = creatingOrderFor === card.uuid;

        return {
          id: card.uuid,
          date: card.encounterDatetime
            ? dayjs(card.encounterDatetime).format('DD MMM YYYY HH:mm')
            : '—',
          intervention: card.hold?.interventionCode ?? '—',
          expectedService: card.expectedServiceStartDate
            ? dayjs(card.expectedServiceStartDate).format('DD MMM YYYY')
            : '—',
          status: status ? (
            <Tag size="sm" type={statusTagType(status)}>
              {status}
            </Tag>
          ) : (
            <Tag size="sm" type="gray">
              Encounter only
            </Tag>
          ),
          orderNo: displayOrderNo(card.hold?.orderNo),
          indications: card.clinicalIndications || '—',
          actions: busy ? (
            <InlineLoading description="Creating order…" />
          ) : (
            <OverflowMenu ariaLabel={`Actions for ${card.hold?.interventionCode || card.uuid}`} flipped size="sm">
              <OverflowMenuItem itemText="Edit" onClick={() => void openEditWorkspace(card)} />
              {showCreateOrder ? (
                <OverflowMenuItem
                  itemText="Create Order"
                  disabled={Boolean(creatingOrderFor)}
                  onClick={() => void onCreateOrder(card)}
                />
              ) : null}
            </OverflowMenu>
          ),
        };
      }),
    [cards, effectiveStatus, creatingOrderFor, onCreateOrder, openEditWorkspace],
  );

  if (patientLoading || (loading && cards.length === 0)) {
    return <DataTableSkeleton role="progressbar" />;
  }

  if (cards.length === 0) {
    return (
      <EmptyState
        headerTitle="Elective preauthorization"
        displayText="elective preauth requests"
        launchForm={() => void openRequestWorkspace()}
      />
    );
  }

  return (
    <div className={styles.widgetContainer}>
      <CardHeader title="Elective preauthorization">
        <Button
          kind="ghost"
          renderIcon={Add}
          iconDescription="Add elective request"
          onClick={() => void openRequestWorkspace()}
        >
          New elective request
        </Button>
      </CardHeader>

      <DataTable rows={tableRows} headers={HEADERS} size="sm" useZebraStyles>
        {({ rows, headers, getHeaderProps, getTableProps }) => (
          <TableContainer>
            <Table {...getTableProps()} aria-label="Elective preauth encounters">
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader {...getHeaderProps({ header })}>{header.header}</TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.cells.map((cell) => {
                      const content = cell.value?.content ?? cell.value;
                      return <TableCell key={cell.id}>{content}</TableCell>;
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
    </div>
  );
};

export default ElectivePreauthExtension;
