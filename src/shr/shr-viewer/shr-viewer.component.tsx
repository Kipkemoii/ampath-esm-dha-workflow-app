import React, { useMemo, useState } from 'react';
import {
  Button,
  DataTable,
  InlineNotification,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableExpandedRow,
  TableExpandHeader,
  TableExpandRow,
  TableHead,
  TableHeader,
  TableRow,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  Tile,
} from '@carbon/react';
import {
  Calendar,
  Chemistry,
  Dashboard,
  DocumentBlank,
  ListChecked,
  Logout,
  Medication,
  Microscope,
  Renew,
  Report,
  User,
} from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';
import type { ShrResourceTypeConfig } from '../../config-schema';
import type { ShrAnyResource, ShrRecordSet } from '../shr.types';
import { buildRows, columnsFor, formatMoment, statusColumnFor, statusTagType, NOT_RECORDED } from './shr-presentation';
import styles from './shr-viewer.scss';

/**
 * Read-only clinician view of a patient's national Shared Health Record.
 *
 * Categories, their order and their labels all come from the `shrResourceTypes`
 * config — adding, removing or relabelling a tab is a config change, not a code
 * change. Only the icon per resource type lives in code, since a config value
 * can't carry a React component.
 */

/** Resource type → tab icon. Anything unmapped (a newly configured category) gets a generic icon. */
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Condition: Report,
  MedicationRequest: Medication,
  Encounter: Calendar,
  Observation: Chemistry,
  ServiceRequest: ListChecked,
  Specimen: Microscope,
  Patient: User,
};

interface ShrViewerProps {
  recordSet: ShrRecordSet;
  resourceTypes: ShrResourceTypeConfig[];
  /** The SHR visit opened by the granted consent. */
  visitId: string;
  /** When the records currently on screen were fetched. */
  syncedAt: string;
  isSyncing: boolean;
  isClosing: boolean;
  /** Set when a close-visit attempt failed — shown here so the loaded records survive. */
  closeError: string;
  /** Set when a refresh failed — likewise shown here, leaving the records already loaded intact. */
  syncError: string;
  onSync: () => void;
  onCloseVisit: () => void;
}

const ShrViewer: React.FC<ShrViewerProps> = ({
  recordSet,
  resourceTypes,
  visitId,
  syncedAt,
  isSyncing,
  isClosing,
  closeError,
  syncError,
  onSync,
  onCloseVisit,
}) => {
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState(0);

  /** Resources bucketed by the configured categories, in config order. */
  const categories = useMemo(() => {
    const byType = new Map<string, ShrAnyResource[]>();
    recordSet.resources.forEach((resource) => {
      const type = resource?.resourceType;
      if (!type) {
        return;
      }
      const bucket = byType.get(type);
      if (bucket) {
        bucket.push(resource);
      } else {
        byType.set(type, [resource]);
      }
    });

    return resourceTypes.map(({ resourceType, label }) => ({
      resourceType,
      label,
      resources: byType.get(resourceType) ?? [],
    }));
  }, [recordSet.resources, resourceTypes]);

  const totalRecords = recordSet.resources.length;
  const populatedCategories = categories.filter((category) => category.resources.length > 0).length;

  const sourceSystem = useMemo(() => {
    if (recordSet.sources.length === 1) {
      return recordSet.sources[0];
    }
    if (recordSet.sources.length > 1) {
      // `total`, not `count` — `count` would make i18next split this into plural
      // variants, and this branch only ever renders for two or more sources.
      return t('shrSourceCount', '{{total}} source systems', { total: recordSet.sources.length });
    }
    return NOT_RECORDED;
  }, [recordSet.sources, t]);

  return (
    <div className={styles.viewer}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>{t('sharedHealthRecord', 'Shared health record')}</h3>
          <p className={styles.provenance}>
            {t('shrNationalRecord', 'National SHR')} · <span className={styles.connected}>●</span>{' '}
            {t('connected', 'Connected')} ·{' '}
            {t('shrVisitActive', 'visit {{visitId}} active', { visitId: shortId(visitId) })} ·{' '}
            {t('shrSyncedAt', 'synced {{time}}', { time: formatMoment(syncedAt) })}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button kind="tertiary" size="sm" renderIcon={Renew} onClick={onSync} disabled={isSyncing || isClosing}>
            {isSyncing ? t('syncing', 'Syncing…') : t('syncNow', 'Sync now')}
          </Button>
          <Button kind="tertiary" size="sm" renderIcon={Logout} onClick={onCloseVisit} disabled={isClosing}>
            {isClosing ? t('closing', 'Closing…') : t('closeVisit', 'Close visit')}
          </Button>
        </div>
      </div>

      {syncError && (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('shrSyncFailed', "Couldn't refresh the records.")}
          subtitle={t('shrSyncFailedDetail', '{{detail}} Use Sync now to try again.', { detail: syncError })}
        />
      )}

      {closeError && (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('shrCloseVisitFailed', "Couldn't close the visit.")}
          subtitle={t(
            'shrCloseVisitFailedDetail',
            '{{detail}} The records below are still loaded — use Close visit to try again.',
            {
              detail: closeError,
            },
          )}
        />
      )}

      <div className={styles.tiles}>
        <Tile className={styles.tile}>
          <span className={styles.tileLabel}>{t('totalRecords', 'Total records')}</span>
          <div className={styles.tileValue}>{totalRecords}</div>
        </Tile>
        <Tile className={styles.tile}>
          <span className={styles.tileLabel}>{t('categories', 'Categories')}</span>
          <div className={styles.tileValue}>{populatedCategories}</div>
        </Tile>
        <Tile className={styles.tile}>
          <span className={styles.tileLabel}>{t('sourceSystem', 'Source system')}</span>
          <div className={styles.tileValueText}>{sourceSystem}</div>
        </Tile>
        <Tile className={styles.tile}>
          <span className={styles.tileLabel}>{t('lastUpdated', 'Last updated')}</span>
          <div className={styles.tileValueText}>
            {recordSet.lastUpdated ? formatMoment(recordSet.lastUpdated) : NOT_RECORDED}
          </div>
        </Tile>
      </div>

      <div className={styles.tabs}>
        <Tabs selectedIndex={selectedTab} onChange={({ selectedIndex }) => setSelectedTab(selectedIndex ?? 0)}>
          <TabList
            aria-label={t('shrCategories', 'Shared health record categories')}
            contained
            scrollDebounceWait={200}
          >
            <Tab renderIcon={Dashboard}>{t('summary', 'Summary')}</Tab>
            {categories.map((category) => {
              const Icon = CATEGORY_ICONS[category.resourceType] ?? DocumentBlank;
              return (
                <Tab key={category.resourceType} renderIcon={Icon}>
                  {`${category.label} ${category.resources.length}`}
                </Tab>
              );
            })}
          </TabList>
          <TabPanels>
            <TabPanel>
              <div className={styles.summaryPanel}>
                {categories.map((category) => {
                  const Icon = CATEGORY_ICONS[category.resourceType] ?? DocumentBlank;
                  return (
                    <div className={styles.summaryRow} key={category.resourceType}>
                      <span className={styles.summaryLabel}>
                        <Icon size={16} />
                        {category.label}
                      </span>
                      <span className={styles.summaryCount}>{category.resources.length}</span>
                    </div>
                  );
                })}
              </div>
            </TabPanel>
            {categories.map((category) => (
              <TabPanel key={category.resourceType}>
                <CategoryTable
                  resourceType={category.resourceType}
                  label={category.label}
                  resources={category.resources}
                />
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};

/** One category's expandable table. Expanding a row reveals a plain-language detail panel. */
const CategoryTable: React.FC<{ resourceType: string; label: string; resources: ShrAnyResource[] }> = ({
  resourceType,
  label,
  resources,
}) => {
  const { t } = useTranslation();
  const headers = useMemo(() => columnsFor(resourceType), [resourceType]);
  const statusColumn = useMemo(() => statusColumnFor(resourceType), [resourceType]);
  const rows = useMemo(() => buildRows(resourceType, resources), [resourceType, resources]);
  const detailsById = useMemo(() => new Map(rows.map((row) => [row.id, row.details])), [rows]);
  const tableRows = useMemo(() => rows.map((row) => ({ id: row.id, ...row.cells })), [rows]);

  if (!resources.length) {
    return (
      <p className={styles.categoryEmpty}>
        {t('shrNoRecordsInCategory', 'No {{category}} in this shared record.', { category: label.toLowerCase() })}
      </p>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <DataTable rows={tableRows} headers={headers} size="sm" useZebraStyles>
        {({ rows: dataRows, headers: dataHeaders, getHeaderProps, getRowProps, getTableProps }) => (
          <TableContainer>
            <Table {...getTableProps()} aria-label={label}>
              <TableHead>
                <TableRow>
                  <TableExpandHeader />
                  {dataHeaders.map((header) => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {dataRows.map((row) => {
                  const details = detailsById.get(row.id) ?? [];
                  return (
                    <React.Fragment key={row.id}>
                      <TableExpandRow {...getRowProps({ row })}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>
                            {statusColumn && cell.info.header === statusColumn && cell.value !== NOT_RECORDED ? (
                              <Tag size="sm" type={statusTagType(String(cell.value))}>
                                {cell.value}
                              </Tag>
                            ) : (
                              cell.value
                            )}
                          </TableCell>
                        ))}
                      </TableExpandRow>
                      <TableExpandedRow colSpan={dataHeaders.length + 1}>
                        <div className={styles.detailPanel}>
                          <div>
                            <Tag size="sm" type="blue">
                              {label}
                            </Tag>
                          </div>
                          {details.length ? (
                            <div className={styles.detailGrid}>
                              {details.map((field) => (
                                <div className={styles.detailField} key={field.label}>
                                  <span className={styles.detailLabel}>{field.label}</span>
                                  <span className={styles.detailValue}>{field.value}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className={styles.detailValue}>
                              {t('shrNoFurtherDetail', 'No further detail was shared for this record.')}
                            </span>
                          )}
                        </div>
                      </TableExpandedRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
    </div>
  );
};

/** First segment of a uuid — enough to identify the visit on screen without a wall of hex. */
function shortId(value: string): string {
  return String(value ?? '').split('-')[0] || String(value ?? '');
}

export default ShrViewer;
