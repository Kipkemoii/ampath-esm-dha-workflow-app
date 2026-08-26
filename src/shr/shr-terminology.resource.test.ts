import { lookupCodeDisplay, primeCodeSystems } from './shr-terminology.resource';
import { conceptText } from './shr-viewer/shr-presentation';
import type { ShrAnyResource } from './shr.types';

/** Minimal fake FHIR CodeSystem response, shaped like the real `em-*` ones. */
function fakeCodeSystemResponse(concepts: Array<{ code: string; display: string }>) {
  return { resourceType: 'CodeSystem', content: 'complete', concept: concepts };
}

function mockFetch(impl: jest.Mock) {
  (global as any).fetch = impl;
  return impl;
}

afterEach(() => {
  jest.restoreAllMocks();
  delete (global as any).fetch;
});

describe('primeCodeSystems / lookupCodeDisplay', () => {
  it('fetches an unresolved coding’s own "/fhir/CodeSystem/" system and caches its concepts', async () => {
    const system = 'https://example.test/fhir/CodeSystem/one';
    const fetchMock = mockFetch(
      jest.fn().mockResolvedValue({ ok: true, json: async () => fakeCodeSystemResponse([{ code: 'X1', display: 'Example One' }]) }),
    );

    const resources: ShrAnyResource[] = [
      { resourceType: 'Observation', code: { coding: [{ system, code: 'X1' }] } } as any,
    ];
    await primeCodeSystems(resources);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(system, expect.objectContaining({ method: 'GET', credentials: 'omit' }));
    expect(lookupCodeDisplay(system, 'X1')).toBe('Example One');
  });

  it('flows through conceptText once resolved, matching how the presenters read it', async () => {
    const system = 'https://example.test/fhir/CodeSystem/two';
    mockFetch(
      jest.fn().mockResolvedValue({ ok: true, json: async () => fakeCodeSystemResponse([{ code: 'X2', display: 'Lower extremities' }]) }),
    );

    await primeCodeSystems([{ resourceType: 'Observation', bodySite: { coding: [{ system, code: 'X2' }] } } as any]);

    expect(conceptText({ coding: [{ system, code: 'X2' }] })).toBe('Lower extremities');
  });

  it('does not fetch when the coding already carries its own display', async () => {
    const system = 'https://example.test/fhir/CodeSystem/three';
    const fetchMock = mockFetch(jest.fn());

    await primeCodeSystems([
      { resourceType: 'Observation', code: { coding: [{ system, code: 'X3', display: 'Already here' }] } } as any,
    ]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not fetch a system whose canonical URL is not shaped like "/fhir/CodeSystem/"', async () => {
    const fetchMock = mockFetch(jest.fn());

    await primeCodeSystems([
      {
        resourceType: 'Encounter',
        class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActEncounterCode', code: 'FLD' },
      } as any,
    ]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves the code unresolved, without throwing, when the fetch rejects', async () => {
    const system = 'https://example.test/fhir/CodeSystem/four';
    mockFetch(jest.fn().mockRejectedValue(new Error('network down')));

    await expect(
      primeCodeSystems([{ resourceType: 'Observation', code: { coding: [{ system, code: 'X4' }] } } as any]),
    ).resolves.toBeUndefined();

    expect(lookupCodeDisplay(system, 'X4')).toBeUndefined();
  });

  it('leaves the code unresolved, without throwing, on a non-ok response', async () => {
    const system = 'https://example.test/fhir/CodeSystem/five';
    mockFetch(jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));

    await primeCodeSystems([{ resourceType: 'Observation', code: { coding: [{ system, code: 'X5' }] } } as any]);

    expect(lookupCodeDisplay(system, 'X5')).toBeUndefined();
  });

  it('returns undefined for a system that was never primed', () => {
    expect(lookupCodeDisplay('https://example.test/fhir/CodeSystem/never-primed', 'anything')).toBeUndefined();
  });

  it('finds an unresolved coding no matter where it sits in the resource tree', async () => {
    const system = 'https://example.test/fhir/CodeSystem/six';
    mockFetch(
      jest.fn().mockResolvedValue({ ok: true, json: async () => fakeCodeSystemResponse([{ code: 'X6', display: 'Deeply Nested' }]) }),
    );

    await primeCodeSystems([
      {
        resourceType: 'ServiceRequest',
        reasonCode: [{ coding: [{ system, code: 'X6' }] }],
      } as any,
    ]);

    expect(lookupCodeDisplay(system, 'X6')).toBe('Deeply Nested');
  });
});
