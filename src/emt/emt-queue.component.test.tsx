/**
 * Tests for the EMT / Referral queue list: loading/empty/error states, row
 * rendering (merged referral + CR data), search filtering, pagination wiring,
 * and that the Handover action opens the modal for the right referral.
 *
 * The handover flow itself (doctor resolution, initiate/verify, OTP, the
 * "already handled elsewhere" race) is covered in
 * `handover-modal/handover-modal.component.test.tsx` — here `HandoverModal` is
 * mocked out to a stub so this file stays focused on the queue/list behavior.
 */
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = jest.fn();
const mockShowSnackbar = jest.fn();
const mockUseSession = jest.fn(() => ({ sessionLocation: { uuid: 'location-uuid-1' } }));
jest.mock('@openmrs/esm-framework', () => ({
  navigate: (...args: unknown[]) => mockNavigate(...args),
  showSnackbar: (...args: unknown[]) => mockShowSnackbar(...args),
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

const mockHandoverModalProps = jest.fn();
jest.mock('./handover-modal/handover-modal.component', () => ({
  __esModule: true,
  default: (props: any) => {
    mockHandoverModalProps(props);
    return (
      <div data-testid="handover-modal-stub">
        <span>Handover modal for {props.referral?.case_number}</span>
        <button onClick={() => props.onHandoverComplete(props.referral)}>Complete handover</button>
        <button onClick={() => props.onReferralUnavailable(props.referral, 'Already handled elsewhere')}>
          Simulate already handled
        </button>
        <button onClick={props.onModalClose}>Close</button>
      </div>
    );
  },
}));

import { EmtApiError } from './types/emt.types';
import EmtQueue from './emt-queue.component';

const referralFixture = {
  submission_id: 3,
  cr_id: 'CR5617849204955-8',
  status: 'pending_acceptance',
  case_number: 'AMB-d22419d8-FAC',
  ambulance_fr_code: 'FID-AMB-916293-3',
  facility_fr_code: 'FID-47-108521-3',
  evacuation_scene: '',
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
  it('opens the handover modal for the clicked row (not some other row)', async () => {
    mockPendingReferrals({ referrals: [olderReferralFixture, referralFixture], count: 2 });
    render(<EmtQueue />);
    await screen.findByText('AMB-d22419d8-FAC');

    const user = userEvent.setup();
    const rows = screen.getAllByRole('row').filter((r) => within(r).queryByRole('button', { name: /handover/i }));
    const targetRow = rows.find((r) => within(r).queryByText('AMB-older-FAC'));
    await user.click(within(targetRow!).getByRole('button', { name: /handover/i }));

    expect(screen.getByTestId('handover-modal-stub')).toBeInTheDocument();
    expect(mockHandoverModalProps).toHaveBeenCalledWith(
      expect.objectContaining({ referral: expect.objectContaining({ case_number: 'AMB-older-FAC' }) }),
    );
  });

  it('on handover completion: refreshes the queue, shows a success toast, and navigates to start the visit', async () => {
    mockPendingReferrals({ referrals: [referralFixture], count: 1 });
    render(<EmtQueue />);
    await screen.findByText('AMB-d22419d8-FAC');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /handover/i }));
    await user.click(screen.getByRole('button', { name: /complete handover/i }));

    expect(mockMutate).toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'success', subtitle: expect.stringContaining('AMB-d22419d8-FAC') }),
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: expect.stringContaining(encodeURIComponent('CR5617849204955-8')) }),
    );
    expect(screen.queryByTestId('handover-modal-stub')).not.toBeInTheDocument();
  });

  it('on "already handled elsewhere": drops the row, refreshes the queue, and warns instead of celebrating', async () => {
    mockPendingReferrals({ referrals: [referralFixture], count: 1 });
    render(<EmtQueue />);
    await screen.findByText('AMB-d22419d8-FAC');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /handover/i }));
    await user.click(screen.getByRole('button', { name: /simulate already handled/i }));

    expect(mockMutate).toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'warning', subtitle: 'Already handled elsewhere' }),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('handover-modal-stub')).not.toBeInTheDocument();
  });
});
