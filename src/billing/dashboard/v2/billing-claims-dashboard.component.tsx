import React, { useEffect, useMemo, useState } from 'react';
import styles from './billing-claims-dashboard.component.scss';
import { DatePicker, DatePickerInput, Tab, TabList, TabPanel, TabPanels, Tabs, Tooltip } from '@carbon/react';
import { Information, Wallet } from '@carbon/react/icons';
import FacilityBills, {
  CASH_PAYER_TAB,
  resetFacilityBillsFilters,
  SHA_PAYER_TAB,
} from './facility-bills/facility-bills.component';
import { useSession } from '@openmrs/esm-framework';
import ActiveVisits from './active-visits/active-visits.component';
import Clearance from './clearance/clearance.component';
import { billBalance, getPayableBills } from './cash-checklist/cash-checklist.resource';
import { getClearanceCounts } from '../../../shared/services/consultation-clearance.resource';
import { fetchClaimsDashboard, useFacilityClaimVisits } from '../../billing-claims.resource';
import { CLAIM_BUCKETS } from './facility-bills/claim-status';
import {
  MetricsCard,
  MetricsCardHeader,
  MetricsCardBody,
  MetricsCardItem,
} from '../../../service-queues/metrics/metrics-cards/metrics-card.component';
import FacilityAndWorkerSlot from '../../../shared/ui/facility-worker-slot/facility-worker.component-slot.component';
import PreauthorizationsTab from './preauth/preauthorizations-tab.component';
import AdmissionRequestsTab from './admissions/admission-requests-tab.component';
import FacilityBillsV3 from '../v3/facility-bills/facility-bills.component';
interface billingClaimsDashboardProps {}

const today = () => new Date().toLocaleDateString('en-CA');

/* The dashboard's own tabs, in order. Named because the summary tiles navigate by index,
   and a bare number stopped saying which tab it meant once SHA claims was inserted in the
   middle of the row. */
const TAB_PENDING_CLEARANCE = 0;
const TAB_FACILITY_BILLS = 1;
const TAB_SHA_CLAIMS = 2;
const TAB_PREAUTHORIZATIONS = 3;
const TAB_ADMISSION_REQUESTS = 4;

/**
 * Which tabs have been opened, so a panel's content is rendered on the first visit to its
 * tab and then stays.
 *
 * Carbon renders every `TabPanel`, hidden ones included — it only sets `hidden` on the ones
 * that aren't selected. So all five panels used to start loading on the dashboard's first
 * paint whichever tab was open, and the two that cost the most (a claim preview per claim
 * for the bills tables, a preauth preview per claim for Preauthorizations) were what tripped
 * the HIE's rate limit before the user had asked to see either.
 *
 * Panels stay mounted once visited, which is the reason they were all left mounted to begin
 * with: FacilityBills keeps its selected patient, filters and fetched data while the user
 * moves between tabs.
 */
function useVisitedTabs(selectedTab: number): Set<number> {
  const [visited, setVisited] = useState<Set<number>>(() => new Set([selectedTab]));
  useEffect(() => {
    setVisited((prev) => (prev.has(selectedTab) ? prev : new Set(prev).add(selectedTab)));
  }, [selectedTab]);
  return visited;
}

/* What each tab is for, on the tab itself. They were paragraphs standing above the tables
   — three lines of standing copy on a page opened dozens of times a day, read once.
   Kept to two short sentences each: what the tab lists, then what you do there. A tooltip
   is capped at a few hundred pixels wide, so a paragraph in one becomes a tall column that
   runs off the screen rather than something anyone reads on the way past. */
const PENDING_HINT =
  'Visits that have started but are not in a service queue yet. Send each patient to triage, then mark their consultation fee paid to release them to be seen.';
const BILLS_HINT =
  'Bills settled at the cash point, for the selected date. Open a patient for the itemised bill, payments received and the balance outstanding.';
const CLAIMS_HINT =
  'SHA claims for the selected date, grouped by status. Open one to check its diagnoses, interventions and invoices, or to submit or close it.';
const PREAUTH_HINT =
  'Preauths for the selected date. Needs raise lists items still waiting for one; Status shows their live position at SHA and can resend doctor consent.';
const ADMISSIONS_HINT =
  'Patients a clinician has asked to admit at this facility. Admit one to a bed, or start the SHA claim for the inpatient visit it opens.';

/* Said on the two claim tiles, because their number is not the live one. See the comment on
   claimCounts: the state stored against a claim is the state it was in when its visit was
   recorded, so anything submitted or closed since still counts here. Open the tile to see
   where the claims actually stand. */
const CLAIM_COUNT_HINT =
  'Counted from the state recorded with each claim, so claims submitted or closed since are still included — this can read high. Open the tile for the live status of each claim.';

/**
 * An explanation hung off a label — a tab's, or a summary tile's.
 *
 * A `title` prop on the `Tab` itself is dropped: Carbon spreads `rest` onto the button and
 * then sets `title: children` afterwards, so the tab's own label always wins. A `title` on
 * an inner span does work, but a native tooltip waits about a second before appearing,
 * which is long enough that people stop expecting one.
 *
 * So the hint is a Carbon `Tooltip` with its delay taken off. It nests inside the tab
 * because Carbon's Tooltip does not inject a trigger of its own — it clones event handlers
 * and aria attributes onto whatever child it is given, and notably not `tabIndex`, so the
 * icon stays inert and the tab keeps sole ownership of focus and keyboard handling. The same
 * holds against the button wrapping a summary tile: the icon takes no focus of its own, and
 * clicking it opens the tile, as clicking anywhere else on it does.
 *
 * `autoAlign` matters here: the tab list scrolls (`overflow-x: auto`), which would clip a
 * statically positioned bubble. Floating-ui places it outside that clipping context — the
 * same thing Carbon does for its own overflowing-tab-label tooltip.
 */
const Hint: React.FC<{ text: string }> = ({ text }) => (
  <Tooltip label={text} align="bottom" enterDelayMs={0} leaveDelayMs={0} autoAlign className={styles.tabHint}>
    <span className={styles.tabHintIcon}>
      <Information size={16} />
    </span>
  </Tooltip>
);

// The chosen filter date is held at module scope, not in component state alone, so it
// survives this dashboard unmounting and remounting while the user stays inside the
// billing route — opening a bill's invoice or the claim workspace and coming back.
// Deliberately not sessionStorage: a page reload should drop it and start on today.
let lastSelectedDate: string | null = null;
// Same reasoning for the open tab: opening a claim now navigates to the claim's own
// page, which unmounts this dashboard, and the breadcrumb back should return to the tab
// the claim was picked from rather than the first one.
let lastSelectedTab: number | null = null;

/**
 * Forget the remembered date, tab and bill filters so the dashboard opens fresh. Called
 * when the user leaves the billing route altogether (see BillingRoot) or re-clicks the
 * "Accounting" side-nav link, both of which are a request for a fresh view.
 */
/**
 * The date the dashboard is currently filtered to, or null when it has been forgotten.
 * The claim page uses it to look up a claim on the day it was being read before falling
 * back to searching the whole location.
 */
export function rememberedBillingDate(): string | null {
  return lastSelectedDate;
}

export function resetBillingDateFilter() {
  lastSelectedDate = null;
  lastSelectedTab = null;
  resetFacilityBillsFilters();
}

const BillingClaimsDashboard: React.FC<billingClaimsDashboardProps> = () => {
  const session = useSession();
  const locationUuid = session.sessionLocation?.uuid ?? '';
  const [billingDate, setBillingDate] = useState<string>(() => lastSelectedDate ?? today());
  const [summaryStartDate, setSummaryStartDate] = useState<string>(() => today());
  const [summaryEndDate, setSummaryEndDate] = useState<string>(() => today());
  const [awaiting, setAwaiting] = useState(0);
  const [cashDue, setCashDue] = useState(0);
  const [selectedTab, setSelectedTab] = useState(() => lastSelectedTab ?? 0);
  const [billsDetailsOpen, setBillsDetailsOpen] = useState(false);
  // Which status bucket the bills tab should open on, with a nonce so clicking the same
  // tile twice still navigates. The payer is no longer part of it: each payer is its own
  // dashboard tab now, so `tab` alone says which list a tile means.
  const [billsNav, setBillsNav] = useState<{ statusKey?: string; nonce: number }>({ nonce: 0 });
  // Which sub-tab to open, with a nonce so repeat clicks still re-navigate.
  const [clearanceNav, setClearanceNav] = useState<{ key?: string; nonce: number }>({ nonce: 0 });
  // The SHA claims tab has its own, since it is a separate instance of FacilityBills and
  // sharing billsNav would send both lists to the same bucket.
  const [claimsNav, setClaimsNav] = useState<{ statusKey?: string; nonce: number }>({ nonce: 0 });
  const visitedTabs = useVisitedTabs(selectedTab);

  useEffect(() => {
    lastSelectedTab = selectedTab;
  }, [selectedTab]);

  useEffect(() => {
    if (locationUuid) {
      getClearanceCounts(locationUuid).then((c) => setAwaiting(c.awaiting));
    }
    getPayableBills(locationUuid).then((bills) => setCashDue(bills.filter((b) => billBalance(b) > 0).length));
  }, [locationUuid]);

  // The claim tiles count the same claims the SHA claims tab lists, from the state
  // /claims-visit stores against each one.
  //
  // Not the live state, deliberately. A claim's live state comes from claim-preview/provider,
  // one call per claim — a facility's day is twenty-odd slow round trips to a rate-limited
  // HIE, and resolving them here spent all of them on these two numbers before the user had
  // asked to see a claim. That resolution now belongs to the SHA claims tab, which is where
  // claims are actually read and which only mounts when opened.
  //
  // The stored state is what the claim was when its visit was recorded, so a claim submitted
  // later still reads DRAFT here: these counts can sit high. CLAIM_COUNT_HINT says so on the
  // tiles, and the tab a tile opens shows the live figure.
  const { claimVisits, loading: claimVisitsLoading } = useFacilityClaimVisits(locationUuid, billingDate);

  const claimCountsReady = !claimVisitsLoading;
  const claimCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const bucket of CLAIM_BUCKETS) {
      const statuses = new Set(bucket.statuses.map((s) => s.toUpperCase()));
      counts[bucket.key] = claimVisits.filter((cv) => {
        const state = (cv.visitResponse?.workflow_state || '').trim().toUpperCase();
        return statuses.has(state);
      }).length;
    }
    return counts;
  }, [claimVisits]);

  const claimTileValue = (bucketKey: string) => (claimCountsReady ? (claimCounts[bucketKey] ?? 0) : 0);

  const claimSummaryDefaults = useMemo(
    () => ({
      draft: null,
      submitted: null,
      failed_to_submit: null,
      closed: null,
      approved: null,
      rejected: null,
      in_review: null,
      sent_back: null,
      paid: null,
    }),
    [],
  );

  const [claimsSummary, setClaimsSummary] = useState<Record<string, number | null>>(claimSummaryDefaults);

  useEffect(() => {
    if (!locationUuid) return;

    const summaryResponse = async () => {
      try {
        const startDate = summaryStartDate || today();
        const endDate = summaryEndDate || startDate;
        const res = await fetchClaimsDashboard(startDate, endDate, locationUuid);
        const rawSummary = Array.isArray(res) && res.length > 0 ? res[0] : {};
        const nextSummary = Object.fromEntries(
          Object.keys(claimSummaryDefaults).map((key) => {
            const value = rawSummary?.[key];
            return [key, value == null ? null : Number(value)];
          }),
        ) as Record<string, number | null>;
        setClaimsSummary({ ...claimSummaryDefaults, ...nextSummary });
      } catch (error) {
        console.error('Failed to fetch claims summary', error);
      }
    };

    summaryResponse();
  }, [claimSummaryDefaults, locationUuid, summaryEndDate, summaryStartDate]);

  const summary: {
    key: string;
    label: string;
    unit: string;
    value: number | null;
    color?: 'red';
  }[] = useMemo(
    () =>
      Object.entries(claimsSummary).map(([key, value]) => ({
        key,
        label: key
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' '),
        unit: 'Claims',
        value,
      })),
    [claimsSummary],
  );

  const handleDateChange = (value: string) => {
    const next = value || today();
    lastSelectedDate = next;
    setBillingDate(next);
  };

  return (
    <>
      <div className={styles.bcLayout}>
        <div className={styles.bcHeader}>
          <span className={styles.bcHeaderIcon}>
            <Wallet size={24} />
          </span>
          <div className={styles.bcHeaderTitle}>
            <h3 className={styles.bcTitle}>Billing &amp; Claims</h3>
          </div>
        </div>
        <div className={styles.summaryFilterRow}>
          <DatePicker
            datePickerType="range"
            dateFormat="Y-m-d"
            value={[summaryStartDate, summaryEndDate]}
            onChange={(dates) => {
              const [startDate, endDate] = dates ?? [];
              const nextStart = startDate ? (startDate as Date).toLocaleDateString('en-CA') : today();
              const nextEnd = endDate ? (endDate as Date).toLocaleDateString('en-CA') : nextStart;
              setSummaryStartDate(nextStart);
              setSummaryEndDate(nextEnd);
            }}
          >
            <DatePickerInput id="summary-start-date" labelText="Start date" placeholder="yyyy-mm-dd" size="sm" />
            <DatePickerInput id="summary-end-date" labelText="End date" placeholder="yyyy-mm-dd" size="sm" />
          </DatePicker>
        </div>
        <div className={styles.summaryRow}>
          {summary.map((s) => (
            <div key={s.key} className={styles.metricButton}>
              <MetricsCard>
                <MetricsCardHeader title={s.label}></MetricsCardHeader>
                <MetricsCardBody>
                  <MetricsCardItem label="" value={s.value ?? '--'} color={s.color} />
                </MetricsCardBody>
              </MetricsCard>
            </div>
          ))}
        </div>
        <div className={styles.bcContent}>
          <div className={styles.bcContentTabs}>
            <DatePicker
              className={styles.tabRowDate}
              datePickerType="single"
              dateFormat="Y-m-d"
              value={billingDate}
              maxDate={today()}
              onChange={(dates) => handleDateChange(dates?.[0] ? (dates[0] as Date).toLocaleDateString('en-CA') : '')}
            >
              <DatePickerInput id="billing-date" labelText="" placeholder="yyyy-mm-dd" size="sm" />
            </DatePicker>
            <Tabs selectedIndex={selectedTab} onChange={({ selectedIndex }) => setSelectedTab(selectedIndex)}>
              {/* Tab list hidden while a bill's details are open, but a visited panel stays
                  mounted so FacilityBills keeps its selected patient and fetched data.
                  See useVisitedTabs for why an unvisited one renders nothing. */}
              <TabList scrollDebounceWait={200}>
                <Tab>
                  Pending clearance
                  <Hint text={PENDING_HINT} />
                </Tab>
                <Tab>
                  Facility bills
                  <Hint text={BILLS_HINT} />
                </Tab>
                <Tab>
                  SHA claims
                  <Hint text={CLAIMS_HINT} />
                </Tab>
                <Tab>
                  Preauthorizations
                  <Hint text={PREAUTH_HINT} />
                </Tab>
                {/* <Tab>Preauth List</Tab> */}
                {/* <Tab>Claims</Tab> */}
                <Tab>
                  Admission Requests
                  <Hint text={ADMISSIONS_HINT} />
                </Tab>
              </TabList>
              <TabPanels>
                <TabPanel>
                  {visitedTabs.has(TAB_PENDING_CLEARANCE) && (
                    <Clearance
                      // The paragraph that introduced this list now hangs off the tab that
                      // opens it — see PENDING_HINT in Clearance.
                      pendingTab={<ActiveVisits date={billingDate} />}
                      initialTab={clearanceNav.key}
                      navNonce={clearanceNav.nonce}
                      date={billingDate}
                    />
                  )}
                </TabPanel>
                <TabPanel>
                  {visitedTabs.has(TAB_FACILITY_BILLS) && (
                    <FacilityBillsV3 locationUuid={locationUuid} billingDate={billingDate} />
                  )}
                </TabPanel>
                <TabPanel>
                  {/* The same table on the SHA payer. It was a sub-tab inside Facility
                      bills; claims are read often enough, and are enough their own thing,
                      to be reached in one click rather than two. */}
                  {visitedTabs.has(TAB_SHA_CLAIMS) && (
                    <FacilityBills
                      locationUuid={locationUuid}
                      billingDate={billingDate}
                      payerTab={SHA_PAYER_TAB}
                      navStatusKey={claimsNav.statusKey}
                      navNonce={claimsNav.nonce}
                    />
                  )}
                </TabPanel>
                <TabPanel>
                  {visitedTabs.has(TAB_PREAUTHORIZATIONS) && (
                    <PreauthorizationsTab
                      locationUuid={locationUuid}
                      billingDate={billingDate}
                      onDateChange={handleDateChange}
                    />
                  )}
                </TabPanel>
                <TabPanel>
                  {/* This tab had no panel at all — five tabs against four panels, so
                      selecting it showed the preauth list or nothing depending on how
                      Carbon indexed them. */}
                  {visitedTabs.has(TAB_ADMISSION_REQUESTS) && <AdmissionRequestsTab locationUuid={locationUuid} />}
                </TabPanel>
              </TabPanels>
            </Tabs>
          </div>
        </div>
      </div>
    </>
  );
};

export default BillingClaimsDashboard;
