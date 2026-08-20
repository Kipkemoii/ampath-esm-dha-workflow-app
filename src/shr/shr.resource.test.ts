/**
 * Tests for the SHR resource layer: the four endpoint calls, the CR identifier
 * lookup, error normalization, the doubly-encoded error parser, and the
 * defensive records flattener.
 *
 * `../shared/utils/get-base-url` (`getHieBaseUrl`) and `@openmrs/esm-framework`
 * (`openmrsFetch`, `restBaseUrl`) are mocked directly, following
 * `emt.resource.test.ts` — this avoids loading the heavy OpenMRS module graph.
 */
jest.mock('../shared/utils/get-base-url', () => ({
  getHieBaseUrl: jest.fn(),
}));

jest.mock('@openmrs/esm-framework', () => ({
  openmrsFetch: jest.fn(),
  restBaseUrl: '/ws/rest/v1',
}));

import { openmrsFetch } from '@openmrs/esm-framework';
import { getHieBaseUrl } from '../shared/utils/get-base-url';
import {
  closeShrVisit,
  createConsentRequest,
  extractShrErrorDetail,
  fetchPatientRecords,
  flattenShrResources,
  getPatientCrIdentifier,
  normalizeError,
  summariseRecords,
  verifyConsentOtp,
} from './shr.resource';
import { ShrApiError } from './shr.types';

const mockOpenmrsFetch = jest.mocked(openmrsFetch);
const mockGetHieBaseUrl = jest.mocked(getHieBaseUrl);

const BASE_URL = 'http://localhost:3000';
const LOCATION_UUID = '18c343eb-b353-462a-9139-b16606e6b6c2';
const CR_ID = 'CR3329858457029-1';

/** Mimics what `openmrsFetch` actually throws for a non-2xx response. */
function fetchError(status: number, message = `Server responded with ${status}`, responseBody?: unknown) {
  return { response: { status }, message, responseBody };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockGetHieBaseUrl.mockResolvedValue(BASE_URL);
});

// ── createConsentRequest ──────────────────────────────────────────────────────

describe('createConsentRequest', () => {
  it('POSTs the consent request, keeping the upstream field names verbatim', async () => {
    const responseFixture = {
      consent_id: 'VCR-20260820-077A7492',
      consent_status: 'Pending',
      otp_record: 'jda8b9p4pq',
      visit_type: 'IP',
      message: 'Consent request created and dispatched via OTP.',
      status: 'success',
    };
    mockOpenmrsFetch.mockResolvedValueOnce({ data: responseFixture } as any);

    const res = await createConsentRequest({
      crId: CR_ID,
      locationUuid: LOCATION_UUID,
      requestedBy: 'Registration Clerk',
      visitType: 'IP',
      emergency: 1,
      incapavity_reason: 'Patient unconscious on arrival',
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${BASE_URL}/shr/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        crId: CR_ID,
        locationUuid: LOCATION_UUID,
        requestedBy: 'Registration Clerk',
        visitType: 'IP',
        emergency: 1,
        // Misspelled upstream; the payload must not "fix" it.
        incapavity_reason: 'Patient unconscious on arrival',
      },
    });
    expect(res.consent_id).toBe('VCR-20260820-077A7492');
    expect(res.otp_record).toBe('jda8b9p4pq');
  });

  it('wraps a failure as a ShrApiError carrying the real HTTP status', async () => {
    mockOpenmrsFetch.mockRejectedValueOnce(fetchError(502, 'Bad gateway'));

    await expect(
      createConsentRequest({
        crId: CR_ID,
        locationUuid: LOCATION_UUID,
        requestedBy: 'Registration Clerk',
        visitType: 'OP',
        emergency: 0,
      }),
    ).rejects.toMatchObject({ name: 'ShrApiError', status: 502 });
  });
});

// ── verifyConsentOtp ─────────────────────────────────────────────────────────

describe('verifyConsentOtp', () => {
  it('POSTs the otp, locationUuid and otpRecord to the consent-scoped verify path', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        consent_token: 'token-xyz',
        visit_id: 'e4b4c287-0aec-4a18-bd3c-2285a94e4503',
        status: 'success',
      },
    } as any);

    const res = await verifyConsentOtp('VCR-20260820-077A7492', {
      otp: '45356',
      locationUuid: LOCATION_UUID,
      otpRecord: 'jda8b9p4pq',
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${BASE_URL}/shr/consents/VCR-20260820-077A7492/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { otp: '45356', locationUuid: LOCATION_UUID, otpRecord: 'jda8b9p4pq' },
    });
    expect(res.consent_token).toBe('token-xyz');
    expect(res.visit_id).toBe('e4b4c287-0aec-4a18-bd3c-2285a94e4503');
  });

  it('keeps the raw doubly-encoded upstream message on the thrown error', async () => {
    mockOpenmrsFetch.mockRejectedValueOnce(
      fetchError(400, 'Server responded with 400', {
        statusCode: 400,
        message:
          'failed to verify patient consent: {"status": "error", "status_code": 400, "message": "OTP already used."}',
      }),
    );

    try {
      await verifyConsentOtp('VCR-1', { otp: '00000', locationUuid: LOCATION_UUID, otpRecord: 'rec' });
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ShrApiError);
      expect((err as ShrApiError).status).toBe(400);
      // Parsing happens at display time, not here.
      expect((err as ShrApiError).message).toContain('failed to verify patient consent:');
      expect(extractShrErrorDetail((err as ShrApiError).message)).toBe('OTP already used.');
    }
  });
});

// ── fetchPatientRecords ──────────────────────────────────────────────────────

describe('fetchPatientRecords', () => {
  it('builds `resources=` from the configured types and sends the consent token header', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: { resourceType: 'Bundle', entry: [{ resource: { resourceType: 'Condition', id: 'c1' } }] },
    } as any);

    const res = await fetchPatientRecords({
      crId: CR_ID,
      resourceTypes: ['Encounter', 'Observation', 'Condition'],
      locationUuid: LOCATION_UUID,
      consentToken: 'token-xyz',
    });

    const [url, options] = mockOpenmrsFetch.mock.calls[0];
    expect(url).toContain(`${BASE_URL}/shr/patient-records?`);
    expect(url).toContain(`crId=${encodeURIComponent(CR_ID)}`);
    expect(url).toContain('resources=Encounter%2CObservation%2CCondition');
    expect(url).toContain(`locationUuid=${LOCATION_UUID}`);
    expect(options).toEqual({ method: 'GET', headers: { 'X-Consent-Token': 'token-xyz' } });
    expect(res.resources).toHaveLength(1);
  });

  it('wraps an expired consent token as a ShrApiError', async () => {
    mockOpenmrsFetch.mockRejectedValueOnce(fetchError(401, 'Unauthorized'));

    await expect(
      fetchPatientRecords({
        crId: CR_ID,
        resourceTypes: ['Condition'],
        locationUuid: LOCATION_UUID,
        consentToken: 'stale',
      }),
    ).rejects.toMatchObject({ status: 401 });
  });
});

// ── closeShrVisit ────────────────────────────────────────────────────────────

describe('closeShrVisit', () => {
  it('POSTs the location to the visit-scoped close path and returns end_date', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        consent_id: 'VCR-20260801-B92B0D4C',
        end_date: '2026-08-02',
        visit_id: 'cba21264-ace2-4861-97d3-fe74084cde37',
        message: 'Consent closure initiated.',
        status: 'success',
      },
    } as any);

    const res = await closeShrVisit('cba21264-ace2-4861-97d3-fe74084cde37', LOCATION_UUID);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${BASE_URL}/shr/visits/cba21264-ace2-4861-97d3-fe74084cde37/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { locationUuid: LOCATION_UUID },
    });
    expect(res.end_date).toBe('2026-08-02');
  });
});

// ── getPatientCrIdentifier ───────────────────────────────────────────────────

describe('getPatientCrIdentifier', () => {
  const CR_TYPE = 'e88dc246-3614-4ee3-8141-1f2a83054e72';

  it('picks the identifier whose type is the Client Registry number type', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          { identifier: '100294H', identifierType: { uuid: '58a4732e-1359-11df-a1f1-0026b9348838' } },
          { identifier: CR_ID, identifierType: { uuid: CR_TYPE } },
        ],
      },
    } as any);

    const crId = await getPatientCrIdentifier('patient-uuid-1');

    expect(mockOpenmrsFetch).toHaveBeenCalledWith('/ws/rest/v1/patient/patient-uuid-1/identifier', { method: 'GET' });
    expect(crId).toBe(CR_ID);
  });

  it('returns an empty string when the patient has no CR number', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: { results: [{ identifier: '100294H', identifierType: { uuid: 'other-type' } }] },
    } as any);

    await expect(getPatientCrIdentifier('patient-uuid-1')).resolves.toBe('');
  });

  it('does not call the API without a patient uuid', async () => {
    await expect(getPatientCrIdentifier('')).resolves.toBe('');
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});

// ── normalizeError / extractShrErrorDetail ───────────────────────────────────

describe('normalizeError', () => {
  it('prefers the server message on responseBody over the fetch boilerplate', () => {
    const err = normalizeError(fetchError(400, 'Server responded with 400', { message: 'OTP already used.' }));
    expect(err.status).toBe(400);
    expect(err.message).toBe('OTP already used.');
  });

  it('treats a raw network failure as status 0', () => {
    expect(normalizeError(new Error('Failed to fetch')).status).toBe(0);
  });

  it('passes an existing ShrApiError through untouched', () => {
    const original = new ShrApiError(409, 'Consent already approved');
    expect(normalizeError(original)).toBe(original);
  });
});

describe('extractShrErrorDetail', () => {
  it('unwraps the nested upstream message', () => {
    expect(
      extractShrErrorDetail(
        'failed to verify patient consent: {"status": "error", "status_code": 400, "message": "OTP already used."}',
      ),
    ).toBe('OTP already used.');
  });

  it('returns the message as-is when there is nothing nested in it', () => {
    expect(extractShrErrorDetail('Service unavailable')).toBe('Service unavailable');
  });

  it('falls back to a generic line when the nested payload is malformed', () => {
    expect(extractShrErrorDetail('failed to verify patient consent: {malformed')).toBe(
      'We could not verify that code. Try again or resend the OTP.',
    );
  });

  it('falls back to a generic line for an empty message', () => {
    expect(extractShrErrorDetail('')).toBe('We could not verify that code. Try again or resend the OTP.');
  });
});

// ── flattenShrResources / summariseRecords ───────────────────────────────────

describe('flattenShrResources', () => {
  it('reads a plain FHIR bundle', () => {
    const resources = flattenShrResources({
      resourceType: 'Bundle',
      entry: [
        { resource: { resourceType: 'Condition', id: 'c1' } },
        { resource: { resourceType: 'Observation', id: 'o1' } },
      ],
    });
    expect(resources.map((r) => r.resourceType)).toEqual(['Condition', 'Observation']);
  });

  it('reads a bundle of per-type searchset bundles', () => {
    const resources = flattenShrResources({
      resourceType: 'Bundle',
      entry: [
        {
          resource: {
            resourceType: 'Bundle',
            type: 'searchset',
            entry: [{ resource: { resourceType: 'Encounter', id: 'e1' } }],
          },
        },
        {
          resource: {
            resourceType: 'Bundle',
            type: 'searchset',
            entry: [{ resource: { resourceType: 'Condition', id: 'c1' } }],
          },
        },
      ],
    });
    expect(resources.map((r) => r.resourceType)).toEqual(['Encounter', 'Condition']);
  });

  it('reads a resourceType-keyed map', () => {
    const resources = flattenShrResources({
      Encounter: [{ resourceType: 'Encounter', id: 'e1' }],
      Condition: [{ resourceType: 'Condition', id: 'c1' }],
    });
    expect(resources).toHaveLength(2);
  });

  it('reads a bare array and a `resources` wrapper', () => {
    expect(flattenShrResources([{ resourceType: 'Specimen', id: 's1' }])).toHaveLength(1);
    expect(flattenShrResources({ resources: [{ resourceType: 'Specimen', id: 's1' }] })).toHaveLength(1);
  });

  it('never counts bundles or operation outcomes as records', () => {
    const resources = flattenShrResources({
      resourceType: 'Bundle',
      entry: [{ resource: { resourceType: 'OperationOutcome', issue: [] } }],
    });
    expect(resources).toHaveLength(0);
  });

  it('tolerates an empty or absent payload', () => {
    expect(flattenShrResources(undefined)).toEqual([]);
    expect(flattenShrResources({ resourceType: 'Bundle', entry: [] })).toEqual([]);
  });
});

describe('summariseRecords', () => {
  it('collects the newest lastUpdated and the distinct sources', () => {
    const summary = summariseRecords({
      resourceType: 'Bundle',
      entry: [
        {
          resource: {
            resourceType: 'Condition',
            id: 'c1',
            meta: { lastUpdated: '2026-08-01T10:00:00Z', source: 'Kenya HIE' },
          },
        },
        {
          resource: {
            resourceType: 'Condition',
            id: 'c2',
            meta: { lastUpdated: '2026-08-14T08:00:00Z', source: 'Kenya HIE' },
          },
        },
      ],
    });

    expect(summary.resources).toHaveLength(2);
    expect(summary.lastUpdated).toBe('2026-08-14T08:00:00Z');
    expect(summary.sources).toEqual(['Kenya HIE']);
  });

  it('leaves lastUpdated undefined when no resource carries one', () => {
    const summary = summariseRecords({ resourceType: 'Bundle', entry: [{ resource: { resourceType: 'Condition' } }] });
    expect(summary.lastUpdated).toBeUndefined();
    expect(summary.sources).toEqual([]);
  });
});
