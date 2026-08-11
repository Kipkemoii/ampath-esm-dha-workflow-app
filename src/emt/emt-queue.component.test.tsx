/**
 * Tests for the EMT / Referral queue list: loading/empty/error states, row
 * rendering (merged referral + CR data), search filtering, pagination wiring,
 * and that the Handover action launches the handover workspace for the right
 * referral.
 *
 * The handover flow itself (doctor resolution, initiate/verify, OTP, the
 * "already handled elsewhere" race) is covered in
 * `handover-modal/handover-modal.component.test.tsx` — here `launchWorkspace`
 * is mocked so this file stays focused on the queue/list behavior and how it
 * wires the workspace launch.
 */
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = jest.fn();
const mockShowSnackbar = jest.fn();
const mockLaunchWorkspace = jest.fn();
const mockUseSession = jest.fn(() => ({ sessionLocation: { uuid: 'location-uuid-1' } }));
jest.mock('@openmrs/esm-framework', () => ({
  navigate: (...args: unknown[]) => mockNavigate(...args),
  showSnackbar: (...args: unknown[]) => mockShowSnackbar(...args),
  launchWorkspace: (...args: unknown[]) => mockLaunchWorkspace(...args),
  useSession: () => mockUseSession(),
}));

jest.mock('../shared/ui/facility-worker-slot/facility-worker.component-slot.component', () => ({
  __esModule: true,
  default: () => null,
}));

const mockUsePendingReferrals = jest.fn();
const mockMutate = jest.fn();
jest.mock('./emt.resource', () => ({
  usePendingReferrals: (...args: unknown[]) => mockUsePendingReferrals(...args),
  EMT_PENDING_KEY: 'emt-pending-referrals',
}));

const mockFetchClientByCrId = jest.fn();
jest.mock('./cr-lookup.resource', () => ({
  fetchClientByCrId: (...args: unknown[]) => mockFetchClientByCrId(...args),
  clientDisplayName: (client: any, crId: string) =>
    client ? [client.first_name, client.last_name].filter(Boolean).join(' ') : crId,
}));

jest.mock('./handover-modal/handover-modal.component', () => ({
  __esModule: true,
  EMT_HANDOVER_WORKSPACE: 'emt-handover-workspace',
}));

const mockSearchPatientByCrNumber = jest.fn();
jest.mock('../resources/patient-search.resource', () => ({
  searchPatientByCrNumber: (...args: unknown[]) => mockSearchPatientByCrNumber(...args),
}));

import { IdentifierTypesUuids } from '../resources/identifier-types';
import { EmtApiError } from './types/emt.types';
import EmtQueue from './emt-queue.component';

const referralFixture = {
  submission_id: 3,
  cr_id: 'CR5617849204955-8',
  status: 'pending_acceptance',
  incident_id: 'INC-20260803100645-254727092999-ffjotq',
  dispatch_id: 'd22419d8-6d36-4b2f-a33c-3e008bd85f77',
  case_number: 'AMB-d22419d8-FAC',
  ambulance_fr_code: 'FID-AMB-916293-3',
  ambulance_registration_number: 'KDN 085T',
  facility_fr_code: 'FID-47-108521-3',
  evacuation_scene: '',
  priority: 'p1 life threatening (als) with altered consciousness',
  referral_reason: '',
  referral_category: '',
  transport_modality: '',
  referral_notes: 'Chief complaint: Test.',
  bundle_id: 'd22419d8-6d36-4b2f-a33c-3e008bd85f77',
  interventions: ['SHA-01-001'],
  requested_at: '2026-08-04T09:37:39.438967Z',
  updated_at: '2026-08-04T09:37:40.428903Z',
};

const olderReferralFixture = {
  ...referralFixture,
  submission_id: 1,
  cr_id: 'CR0000000000000-1',
  case_number: 'AMB-older-FAC',
  requested_at: '2026-08-01T09:37:39.438967Z',
};

function mockPendingReferrals(overrides: Partial<ReturnType<typeof mockUsePendingReferrals>> = {}) {
  mockUsePendingReferrals.mockReturnValue({
    referrals: [],
    count: 0,
    limit: 10,
    offset: 0,
    isLoading: false,
    isValidating: false,
    error: undefined,
    mutate: mockMutate,
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSession.mockReturnValue({ sessionLocation: { uuid: 'location-uuid-1' } });
  mockFetchClientByCrId.mockResolvedValue(null);
  mockSearchPatientByCrNumber.mockResolvedValue({ results: [], totalCount: 0 });
  mockPendingReferrals();
});

describe('EmtQueue list rendering', () => {
  it('shows a loading skeleton while the first page is loading', () => {
    mockPendingReferrals({ isLoading: true });
    render(<EmtQueue />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows an empty state when there are no pending referrals', async () => {
    render(<EmtQueue />);
    expect(await screen.findByText(/no pending emt referrals/i)).toBeInTheDocument();
  });

  it('renders merged referral + CR data once the CR lookup resolves', async () => {
    mockFetchClientByCrId.mockResolvedValueOnce({
      id: 'CR5617849204955-8',
      first_name: 'Jane',
      middle_name: '',
      last_name: 'Doe',
    });
    mockPendingReferrals({ referrals: [referralFixture], count: 1 });

    render(<EmtQueue />);

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('CR5617849204955-8')).toBeInTheDocument();
    expect(screen.getByText('AMB-d22419d8-FAC')).toBeInTheDocument();
    expect(screen.getByText('SHA-01-001')).toBeInTheDocument();
    expect(screen.getByText('pending_acceptance')).toBeInTheDocument();
  });

  it('degrades a single row gracefully when its CR lookup fails, without failing the queue', async () => {
    mockFetchClientByCrId.mockResolvedValueOnce(null);
    mockPendingReferrals({ referrals: [referralFixture], count: 1 });

    render(<EmtQueue />);

    expect(await screen.findByText(/patient details unavailable/i)).toBeInTheDocument();
    // The row still renders its other referral fields even though CR failed.
    expect(screen.getByText('AMB-d22419d8-FAC')).toBeInTheDocument();
  });

  it('sorts referrals by requested_at descending', async () => {
    mockPendingReferrals({ referrals: [olderReferralFixture, referralFixture], count: 2 });

    render(<EmtQueue />);

    const caseCells = await screen.findAllByText(/^AMB-/);
    expect(caseCells[0]).toHaveTextContent('AMB-d22419d8-FAC');
    expect(caseCells[1]).toHaveTextContent('AMB-older-FAC');
  });

  it('filters rows by the search box', async () => {
    mockPendingReferrals({ referrals: [olderReferralFixture, referralFixture], count: 2 });
    render(<EmtQueue />);

    await screen.findByText('AMB-d22419d8-FAC');
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/search this list/i), 'older');

    expect(screen.queryByText('AMB-d22419d8-FAC')).not.toBeInTheDocument();
    expect(screen.getByText('AMB-older-FAC')).toBeInTheDocument();
  });

  it('shows a distinct, retryable error banner for an auth failure and lets the user retry', async () => {
    mockPendingReferrals({ error: new EmtApiError(401, 'Request failed with 401') });
    render(<EmtQueue />);

    expect(await screen.findByText(/session may have expired/i)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(mockMutate).toHaveBeenCalled();
  });

  it('shows a distinct error banner for a 5xx failure', async () => {
    mockPendingReferrals({ error: new EmtApiError(503, 'Request failed with 503') });
    render(<EmtQueue />);
    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument();
  });

  it('passes the server-reported count and current page to Pagination', async () => {
    mockPendingReferrals({ referrals: [referralFixture], count: 47 });
    render(<EmtQueue />);

    await screen.findByText('AMB-d22419d8-FAC');
    // Carbon's Pagination renders the total item count in its "of N items" text.
    expect(screen.getByText(/47/)).toBeInTheDocument();
  });

  it('refetches with the next offset when paging forward', async () => {
    mockPendingReferrals({ referrals: [referralFixture], count: 47 });
    render(<EmtQueue />);
    await screen.findByText('AMB-d22419d8-FAC');

    expect(mockUsePendingReferrals).toHaveBeenLastCalledWith(10, 0, 'location-uuid-1');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /next page/i }));

    await waitFor(() => expect(mockUsePendingReferrals).toHaveBeenLastCalledWith(10, 10, 'location-uuid-1'));
  });
});

describe('EmtQueue handover wiring', () => {
  it('launches the handover workspace for the clicked row (not some other row)', async () => {
    mockPendingReferrals({ referrals: [olderReferralFixture, referralFixture], count: 2 });
    render(<EmtQueue />);
    await screen.findByText('AMB-d22419d8-FAC');

    const user = userEvent.setup();
    const rows = screen.getAllByRole('row').filter((r) => within(r).queryByRole('button', { name: /handover/i }));
    const targetRow = rows.find((r) => within(r).queryByText('AMB-older-FAC'));
    await user.click(within(targetRow!).getByRole('button', { name: /handover/i }));

    expect(mockLaunchWorkspace).toHaveBeenCalledWith(
      'emt-handover-workspace',
      expect.objectContaining({ referral: expect.objectContaining({ case_number: 'AMB-older-FAC' }) }),
    );
  });

  it('refuses to open the handover workspace when there is no default location, instead of sending an empty locationUuid', async () => {
    mockUseSession.mockReturnValue({ sessionLocation: undefined });
    mockPendingReferrals({ referrals: [referralFixture], count: 1 });
    render(<EmtQueue />);
    await screen.findByText('AMB-d22419d8-FAC');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /handover/i }));

    expect(mockLaunchWorkspace).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'error', title: expect.stringMatching(/no default location/i) }),
    );
  });

  it('on handover completion for a not-yet-registered patient: refreshes the queue, shows a success toast, and sends staff to the registry screen', async () => {
    mockPendingReferrals({ referrals: [referralFixture], count: 1 });
    mockSearchPatientByCrNumber.mockResolvedValueOnce({ results: [], totalCount: 0 });
    render(<EmtQueue />);
    await screen.findByText('AMB-d22419d8-FAC');
    // Wait out the row-enrichment CR lookup before queueing the one the
    // handover-completion flow itself makes, so it doesn't get consumed early.
    await waitFor(() => expect(mockFetchClientByCrId).toHaveBeenCalledTimes(1));
    mockFetchClientByCrId.mockResolvedValueOnce({ id: 'CR5617849204955-8', first_name: 'Jane', last_name: 'Doe' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /handover/i }));
    const { onHandoverComplete } = mockLaunchWorkspace.mock.calls[0][1];
    onHandoverComplete(referralFixture);

    expect(mockMutate).toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'success', subtitle: expect.stringContaining('AMB-d22419d8-FAC') }),
    );
    await waitFor(() =>
      expect(mockSearchPatientByCrNumber).toHaveBeenCalledWith('CR5617849204955-8'),
    );
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: expect.stringMatching(/\/home\/registry\?emtCrId=/),
        }),
      ),
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: expect.stringContaining(encodeURIComponent('CR5617849204955-8')) }),
    );
  });

  it('on handover completion for an already-registered patient: skips the registry screen and goes straight to their chart', async () => {
    mockPendingReferrals({ referrals: [referralFixture], count: 1 });
    mockSearchPatientByCrNumber.mockResolvedValueOnce({
      totalCount: 1,
      results: [
        {
          uuid: 'amrs-patient-uuid-1',
          identifiers: [
            { identifier: 'CR5617849204955-8', identifierType: { uuid: IdentifierTypesUuids.CLIENT_REGISTRY_NO_UUID } },
          ],
        },
      ],
    });
    render(<EmtQueue />);
    await screen.findByText('AMB-d22419d8-FAC');
    await waitFor(() => expect(mockFetchClientByCrId).toHaveBeenCalledTimes(1));
    mockFetchClientByCrId.mockResolvedValueOnce({ id: 'CR5617849204955-8', first_name: 'Jane', last_name: 'Doe' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /handover/i }));
    const { onHandoverComplete } = mockLaunchWorkspace.mock.calls[0][1];
    onHandoverComplete(referralFixture);

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: expect.stringContaining('/patient/amrs-patient-uuid-1/chart') }),
      ),
    );
    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: expect.stringContaining('/home/registry') }),
    );
  });

  it('on handover completion when the CR record itself cannot be fetched: warns and still sends staff to the registry screen, without searching AMRS', async () => {
    mockPendingReferrals({ referrals: [referralFixture], count: 1 });
    render(<EmtQueue />);
    await screen.findByText('AMB-d22419d8-FAC');
    await waitFor(() => expect(mockFetchClientByCrId).toHaveBeenCalledTimes(1));
    mockFetchClientByCrId.mockResolvedValueOnce(null);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /handover/i }));
    const { onHandoverComplete } = mockLaunchWorkspace.mock.calls[0][1];
    onHandoverComplete(referralFixture);

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'warning', title: expect.stringMatching(/could not load patient details/i) }),
      ),
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: expect.stringContaining('/home/registry') }),
    );
    expect(mockSearchPatientByCrNumber).not.toHaveBeenCalled();
  });

  it('on "already handled elsewhere": drops the row, refreshes the queue, and warns instead of celebrating', async () => {
    mockPendingReferrals({ referrals: [referralFixture], count: 1 });
    render(<EmtQueue />);
    await screen.findByText('AMB-d22419d8-FAC');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /handover/i }));
    const { onReferralUnavailable } = mockLaunchWorkspace.mock.calls[0][1];
    onReferralUnavailable(referralFixture, 'Already handled elsewhere');

    expect(mockMutate).toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'warning', subtitle: 'Already handled elsewhere' }),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
