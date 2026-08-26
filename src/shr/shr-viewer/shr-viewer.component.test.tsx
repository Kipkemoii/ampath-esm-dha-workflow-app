/**
 * Rendering tests for the record viewer's category navigation: that the
 * vertical category rail lists every configured category with its count, that
 * only the selected category's table is shown, and that selecting a category
 * swaps the panel — including between two categories that share one FHIR
 * `resourceType` (Vitals and Exam findings are both `Observation`).
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ShrResourceTypeConfig } from '../../config-schema';
import type { ShrRecordSet } from '../shr.types';
import ShrViewer from './shr-viewer.component';

/**
 * Carbon's vertical tabs read two browser APIs jsdom doesn't implement.
 *
 * `matchMedia` is reported as not matching: the query Carbon uses is a
 * `max-width` one, so "no match" is the desktop layout this viewer is used on.
 * `ResizeObserver` only drives Carbon's overflow affordances, which nothing
 * here asserts on, so a no-op is enough.
 */
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }),
  });

  (global as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const resourceTypes: ShrResourceTypeConfig[] = [
  { resourceType: 'Condition', label: 'Conditions' },
  { resourceType: 'Encounter', label: 'Encounters' },
  { resourceType: 'Observation', label: 'Vitals', categoryCode: 'vital-signs' },
  { resourceType: 'Observation', label: 'Exam findings', categoryCode: 'exam' },
  { resourceType: 'Observation', label: 'Lab results' },
];

const recordSet: ShrRecordSet = {
  sources: [],
  lastUpdated: '2026-08-26T09:34:02Z',
  raw: null,
  resources: [
    {
      resourceType: 'Observation',
      id: 'vital-1',
      status: 'final',
      category: [{ coding: [{ code: 'vital-signs' }] }],
      code: { coding: [{ display: 'Systolic blood pressure' }] },
      valueQuantity: { value: 120, unit: 'mmHg' },
      effectiveDateTime: '2026-08-03T13:07:17Z',
    },
    {
      resourceType: 'Observation',
      id: 'exam-1',
      status: 'final',
      category: [{ coding: [{ code: 'exam' }] }],
      bodySite: { coding: [{ display: 'Chest' }] },
      valueCodeableConcept: { coding: [{ code: 'rigidity' }] },
      effectiveDateTime: '2026-08-03T13:07:44Z',
    },
    {
      resourceType: 'Encounter',
      id: 'enc-1',
      status: 'finished',
      type: [{ text: 'single_incident' }],
      period: { start: '2026-08-26T09:33:18Z' },
    },
  ] as any,
};

function renderViewer() {
  return render(
    <ShrViewer
      recordSet={recordSet}
      resourceTypes={resourceTypes}
      visitId="c733db19-1111-2222-3333-444455556666"
      syncedAt="2026-08-26T15:57:00Z"
      isSyncing={false}
      isClosing={false}
      closeError=""
      syncError=""
      onSync={jest.fn()}
      onCloseVisit={jest.fn()}
    />,
  );
}

/** The category rail — a tablist, so it is addressable without leaning on class names. */
function rail() {
  return screen.getByRole('tablist', { name: /shared health record categories/i });
}

describe('ShrViewer category navigation', () => {
  it('lists a Summary entry plus every configured category, each with its record count', () => {
    renderViewer();
    const tabs = within(rail()).getAllByRole('tab');

    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Summary',
      'Conditions 0',
      'Encounters 1',
      'Vitals 1',
      'Exam findings 1',
      'Lab results 0',
    ]);
  });

  it('opens on Summary, with no category table shown yet', () => {
    renderViewer();

    expect(within(rail()).getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the selected category’s own columns and rows', async () => {
    renderViewer();
    await userEvent.click(within(rail()).getByRole('tab', { name: 'Vitals 1' }));

    expect(screen.getByRole('columnheader', { name: 'Vital sign' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Systolic blood pressure' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '120 mmHg' })).toBeInTheDocument();
  });

  it('swaps panels between two categories sharing one resourceType', async () => {
    renderViewer();

    await userEvent.click(within(rail()).getByRole('tab', { name: 'Vitals 1' }));
    expect(screen.getByRole('columnheader', { name: 'Vital sign' })).toBeInTheDocument();

    await userEvent.click(within(rail()).getByRole('tab', { name: 'Exam findings 1' }));
    // The exam presenter's columns replace the vitals presenter's — not both at once.
    expect(screen.getByRole('columnheader', { name: 'Body region' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Vital sign' })).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Chest' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Rigidity' })).toBeInTheDocument();
  });

  it('selects a category when its summary card is clicked', async () => {
    renderViewer();

    // The summary's cards are buttons, and live outside the rail's tablist.
    await userEvent.click(screen.getByRole('button', { name: /Exam findings/ }));

    expect(within(rail()).getByRole('tab', { name: /Exam findings/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('columnheader', { name: 'Body region' })).toBeInTheDocument();
  });

  it('tells the clinician a category is empty rather than rendering a headerless table', async () => {
    renderViewer();
    await userEvent.click(within(rail()).getByRole('tab', { name: 'Lab results 0' }));

    // Scoped to the visible panel: Carbon keeps every panel mounted (it measures
    // them to size the rail), so an unscoped query would also match the other
    // empty category's copy of this message. Matched on the invariant part of
    // the sentence, too — with no i18n provider mounted, react-i18next returns
    // the default string without interpolating the category name into it.
    expect(within(screen.getByRole('tabpanel')).getByText(/in this shared record/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
