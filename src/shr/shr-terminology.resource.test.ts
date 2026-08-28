import { lookupCodeDisplay } from './shr-terminology.resource';
import { conceptText } from './shr-viewer/shr-presentation';

const UAT = 'https://nshr-uat.sha.go.ke/fhir/CodeSystem';

describe('lookupCodeDisplay', () => {
  it('resolves a bare vital-sign LOINC code from the bundled code systems', () => {
    expect(lookupCodeDisplay(`${UAT}/em-vital-signs-loinc-cs`, '8480-6')).toBe('Systolic blood pressure');
    expect(lookupCodeDisplay(`${UAT}/em-vital-signs-loinc-cs`, '8310-5')).toBe('Body temperature');
  });

  it('resolves body-region and assessment-finding codes', () => {
    expect(lookupCodeDisplay(`${UAT}/em-body-region`, 'XA45A6')).toBe('Lower extremities');
    expect(lookupCodeDisplay(`${UAT}/em-body-assessment-finding`, 'rigidity')).toBe('Rigidity');
  });

  it('resolves the same system published under a different host, since lookup is keyed by CodeSystem id', () => {
    // `em-crew-role` is published under `hie.go.ke` in UAT, and every system moves
    // host again in production. Only the trailing id is stable.
    expect(lookupCodeDisplay('http://hie.go.ke/fhir/CodeSystem/em-crew-role', 'paramedic')).toBe('Paramedic');
    expect(lookupCodeDisplay('https://nshr.sha.go.ke/fhir/CodeSystem/em-body-region', 'XA20Q1')).toBe('Head');
  });

  it('flows through conceptText, matching how the presenters read it', () => {
    expect(conceptText({ coding: [{ system: `${UAT}/em-body-region`, code: 'XA45A6' }] })).toBe('Lower extremities');
  });

  it('prefers a display the coding already carries over the bundled one', () => {
    expect(
      conceptText({ coding: [{ system: `${UAT}/em-body-region`, code: 'XA45A6', display: 'Already here' }] }),
    ).toBe('Already here');
  });

  it('returns undefined for a system we do not carry, so callers fall back to the raw code', () => {
    expect(lookupCodeDisplay(`${UAT}/not-a-bundled-system`, 'anything')).toBeUndefined();
  });

  it('returns undefined for a code missing from a system we do carry', () => {
    expect(lookupCodeDisplay(`${UAT}/em-dispatch-priority`, 'P99')).toBeUndefined();
  });

  it('returns undefined when either argument is missing', () => {
    expect(lookupCodeDisplay(undefined, 'P1')).toBeUndefined();
    expect(lookupCodeDisplay(`${UAT}/em-dispatch-priority`, undefined)).toBeUndefined();
    expect(lookupCodeDisplay('', '')).toBeUndefined();
  });

  it('does not resolve a generic terminology system that happens to share a code', () => {
    expect(lookupCodeDisplay('http://loinc.org', '8480-6')).toBeUndefined();
  });

  it('only trusts the trailing id when the URL actually names a CodeSystem', () => {
    // The host and resource type are both discarded, so without this guard a bare
    // word — or the ValueSet an IG publishes under the same id — would resolve.
    expect(lookupCodeDisplay('em-body-region', 'XA20Q1')).toBeUndefined();
    expect(lookupCodeDisplay(`${UAT.replace('/CodeSystem', '/ValueSet')}/em-body-region`, 'XA20Q1')).toBeUndefined();
    expect(lookupCodeDisplay(`${UAT}/`, 'XA20Q1')).toBeUndefined();
  });

  it('does not mistake an inherited Object property for a display', () => {
    // `code` is payload data and can name anything.
    for (const code of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
      expect(lookupCodeDisplay(`${UAT}/em-body-region`, code)).toBeUndefined();
    }
  });
});
