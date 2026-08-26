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
  TabListVertical,
  TabPanel,
  TabPanels,
  TabsVertical,
  Tag,
  Tile,
} from '@carbon/react';
import {
  Activity,
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
  Stethoscope,
  User,
} from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';
import type { ShrResourceTypeConfig } from '../../config-schema';
import type { ShrAnyResource, ShrRecordSet } from '../shr.types';
import { buildCategories, type ShrCategory } from './shr-categories';
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

/** `categoryCode` → tab icon, checked before `CATEGORY_ICONS` so a category split off of a
 *  resourceType (e.g. Vitals off of Observation) gets its own icon instead of its sibling's. */
const CATEGORY_CODE_ICONS: Record<string, React.ElementType> = {
  'vital-signs': Activity,
  exam: Stethoscope,
};

function iconFor(category: ShrCategory): React.ElementType {
  return (
    (category.categoryCode && CATEGORY_CODE_ICONS[category.categoryCode]) ||
    CATEGORY_ICONS[category.resourceType] ||
    DocumentBlank
  );
}

/**
 * Unique key for a category tab — `resourceType` alone collides once one
 * resourceType is split by `categoryCode` (Vitals and Exam findings are both
 * `Observation`). A configured catch-all and the uncategorised safety net would
 * both key as `Observation:`, but `buildCategories` only ever emits one of them.
 */
function categoryKey(category: ShrCategory): string {
  return `${category.resourceType}:${category.categoryCode ?? ''}`;
}

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
  /** Opens the closure confirmation — closing is never immediate on click. */
  onCloseVisit: () => void;
  /**
   * The closure confirmation panel, when one is open. Owned by the parent (it
   * owns the close request), rendered here so it sits with the button that
   * opened it and the records stay on screen behind it.
   */
  closePanel?: React.ReactNode;
}

const ShrViewer: React.FC<ShrViewerProps> = ({
  recordSet,
  resourceTypes,
  visitId,
  syncedAt,
  isSyncing,
  isClosing,
  closeError,
  closePanel,
  syncError,
  onSync,
  onCloseVisit,
}) => {
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState(0);

  /**
   * Resources bucketed into tabs: the configured categories in config order,
   * then any further category found in the payload. See `buildCategories`.
   */
  const uncategorisedLabel = t('shrUncategorisedRecords', 'Uncategorised');
  const categories = useMemo(
    () => buildCategories(recordSet.resources, resourceTypes, { uncategorisedLabel }),
    [recordSet.resources, resourceTypes, uncategorisedLabel],
  );

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
          <Button
            kind="tertiary"
            size="sm"
            renderIcon={Logout}
            onClick={onCloseVisit}
            disabled={isClosing || Boolean(closePanel)}
          >
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

      {closePanel}

      {closeError && !closePanel && (
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
        <TabsVertical
          selectedIndex={selectedTab}
          onChange={({ selectedIndex }) => setSelectedTab(selectedIndex ?? 0)}
        >
          {/* `sm` — Carbon defaults vertical tabs to `xl` (64px rows), which is far
              taller than this app's own navigation and makes a rail of this many
              categories dominate the pane. `sm` also clamps labels to one line. */}
          <TabListVertical aria-label={t('shrCategories', 'Shared health record categories')} size="sm">
            <Tab renderIcon={Dashboard}>{t('summary', 'Summary')}</Tab>
            {categories.map((category) => {
              const Icon = iconFor(category);
              return (
                <Tab key={categoryKey(category)} renderIcon={Icon}>
                  {/* Two spans so the count can sit hard right against the label's
                      left. The whitespace between them is dropped by the flex
                      container but keeps the accessible name reading "Vitals 5". */}
                  <span className={styles.railLabel}>{category.label}</span>{' '}
                  <span className={category.resources.length ? styles.railCount : styles.railCountEmpty}>
                    {category.resources.length}
                  </span>
                </Tab>
              );
            })}
          </TabListVertical>
          <TabPanels>
            <TabPanel>
              {/* Cards rather than full-width rows: stretched rows put each count
                  an entire pane-width away from its own label. Each one selects
                  its category, so the overview doubles as a way in rather than
                  repeating the rail for nothing. */}
              <div className={styles.summaryGrid}>
                {categories.map((category, index) => {
                  const Icon = iconFor(category);
                  const count = category.resources.length;
                  return (
                    <button
                      type="button"
                      key={categoryKey(category)}
                      className={count ? styles.summaryCard : styles.summaryCardEmpty}
                      // +1 — the Summary tab itself is index 0.
                      onClick={() => setSelectedTab(index + 1)}
                    >
                      <span className={styles.summaryCardLabel}>
                        <Icon size={16} />
                        {category.label}
                      </span>{' '}
                      <span className={styles.summaryCardCount}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </TabPanel>
            {categories.map((category) => (
              <TabPanel key={categoryKey(category)}>
                <CategoryTable
                  resourceType={category.resourceType}
                  categoryCode={category.categoryCode}
                  label={category.label}
                  resources={category.resources}
                />
              </TabPanel>
            ))}
          </TabPanels>
        </TabsVertical>
      </div>
    </div>
  );
};

/** One category's expandable table. Expanding a row reveals a plain-language detail panel. */
const CategoryTable: React.FC<{
  resourceType: string;
  categoryCode?: string;
  label: string;
  resources: ShrAnyResource[];
}> = ({ resourceType, categoryCode, label, resources }) => {
  const { t } = useTranslation();
  const headers = useMemo(() => columnsFor(resourceType, categoryCode), [resourceType, categoryCode]);
  const statusColumn = useMemo(() => statusColumnFor(resourceType, categoryCode), [resourceType, categoryCode]);
  const rows = useMemo(
    () => buildRows(resourceType, resources, categoryCode),
    [resourceType, resources, categoryCode],
  );
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
