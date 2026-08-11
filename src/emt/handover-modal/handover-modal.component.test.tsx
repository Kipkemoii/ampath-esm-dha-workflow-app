/**
 * Tests for the OTP-verified handover flow: resolving the receiving doctor
 * (provider + HWR search), initiate success/failure, verify success/failure,
 * and the "already handled elsewhere" (404) race condition on both calls.
 */
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockShowSnackbar = jest.fn();
jest.mock('@openmrs/esm-framework', () => ({
  showSnackbar: (...args: unknown[]) => mockShowSnackbar(...args),
}));

const mockInitiateHandover = jest.fn();
const mockVerifyHandoverOtp = jest.fn();
jest.mock('../emt.resource', () => ({
  initiateHandover: (...args: unknown[]) => mockInitiateHandover(...args),
  verifyHandoverOtp: (...args: unknown[]) => mockVerifyHandoverOtp(...args),
  getHandoverRequestId: (res: any) => res?.request_id ?? res?.requestId ?? '',
}));

const mockSearchOpenMrsProviders = jest.fn();
const mockSearchHealthWorkerRegistry = jest.fn();
jest.mock('../../billing/dashboard/v3/preauth/preauth.resource', () => ({
  searchOpenMrsProviders: (...args: unknown[]) => mockSearchOpenMrsProviders(...args),
  searchHealthWorkerRegistry: (...args: unknown[]) => mockSearchHealthWorkerRegistry(...args),
}));

import { EmtApiError, type EmtReferralRow } from '../types/emt.types';
import HandoverModal from './handover-modal.component';

const referral: EmtReferralRow = {
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
  patientName: 'Jane Doe',
  crLoading: false,
};

const providerHit = {
  uuid: 'provider-uuid-1',
  display: 'Dr. Alice Mwangi',
  identifier: 'PROV-1',
  nationalId: '12345678',
};

const hwrHitFixture = {
  membership: {
    full_name: 'Dr. Alice Mwangi',
    registration_id: 'A13579',
    licensing_body: 'Kenya Medical Practitioners and Dentists Council',
  },
};

function baseProps() {
  return {
    referral,
    locationUuid: 'location-uuid-1',
    closeWorkspace: jest.fn(),
    promptBeforeClosing: jest.fn(),
    onHandoverComplete: jest.fn(),
    onReferralUnavailable: jest.fn(),
  };
}

/** Drives the modal from the initial "doctor" step through to "confirm". */
async function resolveDoctorAndContinue(user: ReturnType<typeof userEvent.setup>) {
  mockSearchOpenMrsProviders.mockResolvedValueOnce([providerHit]);
  mockSearchHealthWorkerRegistry.mockResolvedValueOnce([hwrHitFixture]);

  await user.type(screen.getByPlaceholderText(/type at least 2 characters/i), 'Alice');
  const option = await screen.findByText(/Dr\. Alice Mwangi/, {}, { timeout: 2000 });
  await user.click(option);

  await screen.findByText(/A13579/);
  await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: /continue/i }));

  await screen.findByText(/confirm handover/i);
}

function typeOtp(container: HTMLElement, digits: string) {
  const inputs = Array.from(container.querySelectorAll('input[id^="otp-"]')) as HTMLInputElement[];
  act(() => {
    digits.split('').forEach((digit, i) => {
      fireEventChange(inputs[i], digit);
    });
  });
}

// OTPInput expects a native change event; userEvent.type works too but this is
// faster and avoids per-keystroke debounce concerns in this digit widget.
function fireEventChange(input: HTMLInputElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  nativeInputValueSetter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('doctor resolution', () => {
  it('resolves the receiving doctor via provider + HWR search and gates Continue on it', async () => {
    const user = userEvent.setup();
    render(<HandoverModal {...baseProps()} />);

    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    await resolveDoctorAndContinue(user);

    expect(mockSearchHealthWorkerRegistry).toHaveBeenCalledWith({
      identifierType: 'National ID',
      identifierValue: '12345678',
      locationUuid: 'location-uuid-1',
    });
    expect(screen.getByText(/KMPDC/)).toBeInTheDocument();
    expect(screen.getByText(/A13579/)).toBeInTheDocument();
  });

  it('lets staff proceed to a manual National ID search when the provider has none on file', async () => {
    mockSearchOpenMrsProviders.mockResolvedValueOnce([{ uuid: 'p2', display: 'Dr. No Id' }]);
    const user = userEvent.setup();
    render(<HandoverModal {...baseProps()} />);

    await user.type(screen.getByPlaceholderText(/type at least 2 characters/i), 'No Id');
    await user.click(await screen.findByText('Dr. No Id'));

    expect(await screen.findByText(/enter it manually and search hwr/i)).toBeInTheDocument();
    expect(mockSearchHealthWorkerRegistry).not.toHaveBeenCalled();

    mockSearchHealthWorkerRegistry.mockResolvedValueOnce([hwrHitFixture]);
    await user.type(screen.getByLabelText(/doctor national id/i), '99999999');
    await user.click(screen.getByRole('button', { name: /search hwr/i }));

    await screen.findByText(/A13579/);
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
  });

  it('keeps Continue disabled when the HWR hit has no registration number', async () => {
    mockSearchOpenMrsProviders.mockResolvedValueOnce([providerHit]);
    mockSearchHealthWorkerRegistry.mockResolvedValueOnce([{ membership: { full_name: 'Dr. No Reg' } }]);
    const user = userEvent.setup();
    render(<HandoverModal {...baseProps()} />);

    await user.type(screen.getByPlaceholderText(/type at least 2 characters/i), 'Alice');
    await user.click(await screen.findByText(/Dr\. Alice Mwangi/));

    expect(await screen.findByText(/no registration number on file/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });
});

describe('initiate', () => {
  it('on success: sends the exact request body and moves to the OTP step', async () => {
    mockInitiateHandover.mockResolvedValueOnce({ request_id: 'req-123' });
    const user = userEvent.setup();
    render(<HandoverModal {...baseProps()} />);
    await resolveDoctorAndContinue(user);

    await user.click(screen.getByRole('button', { name: /send otp/i }));

    expect(mockInitiateHandover).toHaveBeenCalledWith({
      incidenceNumber: 'AMB-d22419d8-FAC',
      identifier: 'A13579',
      identifierType: 'registration_number',
      regulator: 'KMPDC',
      locationUuid: 'location-uuid-1',
    });
    expect(await screen.findByText(/enter doctor otp/i)).toBeInTheDocument();
  });

  it('on a 409 conflict: shows a distinct inline message and stays on confirm', async () => {
    mockInitiateHandover.mockRejectedValueOnce(new EmtApiError(409, 'Request failed with 409'));
    const user = userEvent.setup();
    render(<HandoverModal {...baseProps()} />);
    await resolveDoctorAndContinue(user);

    await user.click(screen.getByRole('button', { name: /send otp/i }));

    expect(await screen.findByText(/already been initiated or completed/i)).toBeInTheDocument();
    expect(screen.getByText(/confirm handover/i)).toBeInTheDocument();
  });

  it('on 404 (already handled elsewhere): notifies the parent instead of showing an inline error', async () => {
    mockInitiateHandover.mockRejectedValueOnce(new EmtApiError(404, 'Request failed with 404'));
    const props = baseProps();
    const user = userEvent.setup();
    render(<HandoverModal {...props} />);
    await resolveDoctorAndContinue(user);

    await user.click(screen.getByRole('button', { name: /send otp/i }));

    await waitFor(() => expect(props.onReferralUnavailable).toHaveBeenCalledWith(referral, expect.stringMatching(/handled elsewhere/i)));
    expect(screen.queryByText(/already been initiated or completed/i)).not.toBeInTheDocument();
  });
});

describe('verify', () => {
  async function getToOtpStep(user: ReturnType<typeof userEvent.setup>) {
    mockInitiateHandover.mockResolvedValueOnce({ request_id: 'req-123' });
    await resolveDoctorAndContinue(user);
    await user.click(screen.getByRole('button', { name: /send otp/i }));
    await screen.findByText(/enter doctor otp/i);
  }

  it('on success: verifies with incidenceNumber/requestId/otp and completes the handover', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    const { container } = render(<HandoverModal {...props} />);
    await getToOtpStep(user);

    typeOtp(container, '654321');
    await waitFor(() => expect(screen.getByRole('button', { name: /verify/i })).toBeEnabled());
    mockVerifyHandoverOtp.mockResolvedValueOnce({ status: 'verified' });
    await user.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() =>
      expect(mockVerifyHandoverOtp).toHaveBeenCalledWith({
        incidenceNumber: 'AMB-d22419d8-FAC',
        requestId: 'req-123',
        otp: '654321',
        locationUuid: 'location-uuid-1',
      }),
    );
    expect(props.onHandoverComplete).toHaveBeenCalledWith(referral);
  });

  it('on an invalid/expired OTP: keeps the modal open on the OTP step with a specific message', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    const { container } = render(<HandoverModal {...props} />);
    await getToOtpStep(user);

    typeOtp(container, '000000');
    mockVerifyHandoverOtp.mockRejectedValueOnce(new EmtApiError(410, 'Request failed with 410'));
    await user.click(screen.getByRole('button', { name: /verify/i }));

    expect(await screen.findByText(/otp has expired/i)).toBeInTheDocument();
    expect(screen.getByText(/enter doctor otp/i)).toBeInTheDocument();
    expect(props.onHandoverComplete).not.toHaveBeenCalled();
  });

  it('on 404 (already handled elsewhere) during verify: notifies the parent, does not complete the handover', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    const { container } = render(<HandoverModal {...props} />);
    await getToOtpStep(user);

    typeOtp(container, '654321');
    mockVerifyHandoverOtp.mockRejectedValueOnce(new EmtApiError(404, 'Request failed with 404'));
    await user.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => expect(props.onReferralUnavailable).toHaveBeenCalledWith(referral, expect.stringMatching(/handled elsewhere/i)));
    expect(props.onHandoverComplete).not.toHaveBeenCalled();
  });
});
