/**
 * Tests for the CR-by-crId lookup helper and clientDisplayName utility.
 */
jest.mock('../registry/registry.resource', () => ({
  fetchClientRegistryData: jest.fn(),
}));

import { fetchClientRegistryData } from '../registry/registry.resource';
import { fetchClientByCrId, clientDisplayName } from './cr-lookup.resource';

const mockFetchClientRegistryData = jest.mocked(fetchClientRegistryData);

beforeEach(() => {
  jest.resetAllMocks();
});

describe('fetchClientByCrId', () => {
  it('searches the client registry by CR id and returns the first match', async () => {
    const client = {
      id: 'CR5617849204955-8',
      first_name: 'Jane',
      middle_name: '',
      last_name: 'Doe',
      gender: 'F',
      date_of_birth: '1990-01-15',
      identification_type: 'id',
      identification_number: 'CR5617849204955-8',
    };
    mockFetchClientRegistryData.mockResolvedValueOnce([client]);

    const result = await fetchClientByCrId('CR5617849204955-8', 'loc-uuid-1');

    expect(mockFetchClientRegistryData).toHaveBeenCalledWith({
      identificationNumber: 'CR5617849204955-8',
      identificationType: 'CR id',
      locationUuid: 'loc-uuid-1',
    });
    expect(result?.first_name).toBe('Jane');
  });

  it('returns null when the search finds no matching client', async () => {
    mockFetchClientRegistryData.mockResolvedValueOnce([]);
    const result = await fetchClientByCrId('CR-MISSING', 'loc-uuid-1');
    expect(result).toBeNull();
  });

  it('returns null when the search fails (graceful degradation)', async () => {
    mockFetchClientRegistryData.mockRejectedValueOnce(new Error('Request failed with 404: Not found'));
    const result = await fetchClientByCrId('CR-MISSING', 'loc-uuid-1');
    expect(result).toBeNull();
  });

  it('returns null for an empty cr_id without searching', async () => {
    const result = await fetchClientByCrId('', 'loc-uuid-1');
    expect(result).toBeNull();
    expect(mockFetchClientRegistryData).not.toHaveBeenCalled();
  });

  it('returns null for a missing location uuid without searching', async () => {
    const result = await fetchClientByCrId('CR5617849204955-8', '');
    expect(result).toBeNull();
    expect(mockFetchClientRegistryData).not.toHaveBeenCalled();
  });
});

describe('clientDisplayName', () => {
  it('joins first, middle, last names', () => {
    const client = {
      first_name: 'Jane',
      middle_name: 'Akinyi',
      last_name: 'Doe',
    } as any;
    expect(clientDisplayName(client, 'CR123')).toBe('Jane Akinyi Doe');
  });

  it('skips missing name parts', () => {
    const client = {
      first_name: 'Jane',
      middle_name: '',
      last_name: 'Doe',
    } as any;
    expect(clientDisplayName(client, 'CR123')).toBe('Jane Doe');
  });

  it('falls back to cr_id when client is null', () => {
    expect(clientDisplayName(null, 'CR123')).toBe('CR123');
  });
});
