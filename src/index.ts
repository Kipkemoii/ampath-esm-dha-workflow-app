/**
 * This is the entrypoint file of the application. It communicates the
 * important features of this microfrontend to the app shell. It
 * connects the app shell to the React application(s) that make up this
 * microfrontend.
 */
import { getAsyncLifecycle, defineConfigSchema, getSyncLifecycle } from '@openmrs/esm-framework';
import { configSchema } from './config-schema';
import { registryDashboardMeta } from './registry-dashboard.meta';
import { createDashboardLink } from './createDashboardLink';
import { queueDashboardMeta } from './queue-dashboard.meta';
import { pharmacyDashboardMeta } from './pharmacy-dashboard.meta';
import { triageDashboardMeta } from './triage-dashboard.meta';

export const moduleName = '@ampath/esm-dha-workflow-app';

const options = {
  featureName: 'Consulation Workflow',
  moduleName,
};

/**
 * This tells the app shell how to obtain translation files: that they
 * are JSON files in the directory `../translations` (which you should
 * see in the directory structure).
 */
export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

/**
 * This function performs any setup that should happen at microfrontend
 * load-time (such as defining the config schema) and then returns an
 * object which describes how the React application(s) should be
 * rendered.
 */
export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

export const navLinks = getAsyncLifecycle(() => import('./side-nav-menu/nav-links'), {
  featureName: 'side-nav-workflow-link',
  moduleName,
});

/**
 * This named export tells the app shell that the default export of `root.component.tsx`
 * should be rendered when the route matches `root`. The full route
 * will be `openmrsSpaBase() + 'root'`, which is usually
 * `/openmrs/spa/root`.
 */
export const root = getAsyncLifecycle(() => import('./root.component'), options);
export const registry = getAsyncLifecycle(() => import('./registry/registry.component'), options);
export const waitingPatientsExtension = getAsyncLifecycle(
  () => import('./service-queues/metrics/metrics-cards/waiting-patients.extension'),
  options,
);
export const attendedToPatientsExtension = getAsyncLifecycle(
  () => import('./service-queues/metrics/metrics-cards/attended-patients.extension'),
  options,
);
export const triageWaitingPatientsExtension = getAsyncLifecycle(
  () => import('./triage/metrics/waiting-patients.extension'),
  options,
);
export const triageAttendedToPatientsExtension = getAsyncLifecycle(
  () => import('./triage/metrics/attended-patients.extension'),
  options,
);

export const workflowRegistryLink = getAsyncLifecycle(() => import('./widgets/workflow-registry-link.extension'), {
  featureName: 'workflow-registry-link',
  moduleName,
});

export const registryDashboardLink = getSyncLifecycle(createDashboardLink(registryDashboardMeta), options);

export const registryExtension = getAsyncLifecycle(() => import('./registry/registry.component'), options);

export const queueDashboardLink = getSyncLifecycle(createDashboardLink(queueDashboardMeta), options);

export const queueDashboardExtension = getAsyncLifecycle(() => import('./dashboard/dashboard.component'), options);

export const pharmacyDashboardLink = getSyncLifecycle(createDashboardLink(pharmacyDashboardMeta), options);

export const triageDashboardLink = getSyncLifecycle(createDashboardLink(triageDashboardMeta), options);

export const triageQueueExtension = getAsyncLifecycle(() => import('./triage/triage.component'), options);
