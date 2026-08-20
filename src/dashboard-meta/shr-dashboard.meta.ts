/**
 * Patient-chart "SHR" tab.
 *
 * `path`, `title` and `icon` intentionally mirror
 * `ampath-esm-hie-registry-manager-app`'s `patientChartShrdMetaData` so the swap
 * is seamless — same tab, same position between Results and Visits, same icon.
 * Only the slot is new, because this repo now owns the tab's contents.
 *
 * Follow-up in the other repo: once this is live, remove its `shrDashboardLink`
 * registration (and the now-dead `src/hie/shr/` +
 * `src/hie/modal/otp-verification/` code) or the sidebar will show two "SHR"
 * entries.
 */
export const shrDashboardMeta = {
  path: 'shr-v2',
  slot: 'patient-chart-shared-health-record-dashboard-slot',
  title: 'SHR',
  icon: 'omrs-icon-event-schedule',
};
