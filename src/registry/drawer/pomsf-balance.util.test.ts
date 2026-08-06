import { type Scheme } from '../types';
import { type PomsfBalance } from '../../claims';
import {
  findPomsfBenefitBalance,
  formatKes,
  getAllPomsfBenefitBalances,
  getPomsfDisplayBalance,
  isPomsfActive,
} from './pomsf-balance.util';

function makeScheme(schemeName: string, status: string): Scheme {
  return {
    schemeName,
    memberType: 'BENEFICIARY',
    coverageType: 'SHIF',
    policy: { startDate: '', endDate: '', number: '' },
    coverage: { startDate: '', endDate: '', message: '', reason: '', possibleSolution: null, status },
    principalContributor: {
      idNumber: '',
      name: '',
      crNumber: '',
      relationship: '',
      employmentType: '',
      employerDetails: undefined,
    },
  } as unknown as Scheme;
}

function makePomsfBalance(
  benefits: Array<{ benefitCode: string; balance: number | undefined; name?: string }>,
): PomsfBalance {
  return {
    memberPolicies: [
      {
        benefit: benefits.map(({ benefitCode, balance, name = '' }) => ({
          benefitId: 1,
          name,
          description: '',
          type: '',
          limit: 2000000,
          benefitShared: null,
          benefitRelation: null,
          benefitGender: null,
          subBenefit: [],
          balance: balance === undefined ? [] : [{ member: 'self', balance }],
          benefitCode,
        })),
      },
    ],
  } as unknown as PomsfBalance;
}

describe('isPomsfActive', () => {
  it('is true when a POMSF scheme has coverage status 1', () => {
    expect(isPomsfActive([makeScheme('POMSF', '1')])).toBe(true);
  });

  it('is false when POMSF is present but not active', () => {
    expect(isPomsfActive([makeScheme('POMSF', '0')])).toBe(false);
  });

  it('is false when POMSF is absent', () => {
    expect(isPomsfActive([makeScheme('UHC', '1')])).toBe(false);
  });
});

describe('findPomsfBenefitBalance', () => {
  it('finds the balance for a matching benefit code', () => {
    const pomsfBalance = makePomsfBalance([{ benefitCode: 'PMF-12', balance: 197000 }]);
    expect(findPomsfBenefitBalance(pomsfBalance, 'PMF-12')).toBe(197000);
  });

  it('returns null when no benefit line matches the code', () => {
    const pomsfBalance = makePomsfBalance([{ benefitCode: 'PMF-07', balance: 2000000 }]);
    expect(findPomsfBenefitBalance(pomsfBalance, 'PMF-12')).toBeNull();
  });

  it('returns null when the matching benefit has no balance entries', () => {
    const pomsfBalance = makePomsfBalance([{ benefitCode: 'PMF-12', balance: undefined }]);
    expect(findPomsfBenefitBalance(pomsfBalance, 'PMF-12')).toBeNull();
  });

  it('returns null when there is no balance data yet', () => {
    expect(findPomsfBenefitBalance(null, 'PMF-12')).toBeNull();
  });
});

describe('getPomsfDisplayBalance', () => {
  const pomsfBalance = makePomsfBalance([
    { benefitCode: 'PMF-07', balance: 2000000 },
    { benefitCode: 'PMF-12', balance: 197000 },
  ]);

  it('resolves the Outpatient Services (PMF-12) balance when POMSF is active and Visit type is Outpatient', () => {
    const schemes = [makeScheme('POMSF', '1')];
    expect(getPomsfDisplayBalance(schemes, 'Outpatient', pomsfBalance)).toBe(197000);
  });

  it('resolves the Inpatient Services (PMF-07) balance when POMSF is active and Visit type is Inpatient', () => {
    const schemes = [makeScheme('POMSF', '1')];
    expect(getPomsfDisplayBalance(schemes, 'Inpatient', pomsfBalance)).toBe(2000000);
  });

  it('returns null when POMSF is not Active', () => {
    const schemes = [makeScheme('POMSF', '0')];
    expect(getPomsfDisplayBalance(schemes, 'Outpatient', pomsfBalance)).toBeNull();
  });

  it('returns null when a non-POMSF scheme is Active but POMSF is not present', () => {
    const schemes = [makeScheme('UHC', '1')];
    expect(getPomsfDisplayBalance(schemes, 'Outpatient', pomsfBalance)).toBeNull();
  });

  it('returns null when Visit type has not been picked yet', () => {
    const schemes = [makeScheme('POMSF', '1')];
    expect(getPomsfDisplayBalance(schemes, '', pomsfBalance)).toBeNull();
  });

  it('returns null when no matching benefit line is found in the response', () => {
    const schemes = [makeScheme('POMSF', '1')];
    const balanceMissingOutpatient = makePomsfBalance([{ benefitCode: 'PMF-07', balance: 2000000 }]);
    expect(getPomsfDisplayBalance(schemes, 'Outpatient', balanceMissingOutpatient)).toBeNull();
  });

  it('still returns 0 (not null) for a zero balance, since it is meaningful to staff', () => {
    const schemes = [makeScheme('POMSF', '1')];
    const zeroBalance = makePomsfBalance([{ benefitCode: 'PMF-12', balance: 0 }]);
    expect(getPomsfDisplayBalance(schemes, 'Outpatient', zeroBalance)).toBe(0);
  });
});

describe('getAllPomsfBenefitBalances', () => {
  it('lists every benefit line with its name, code, and balance', () => {
    const pomsfBalance = makePomsfBalance([
      { benefitCode: 'PMF-07', balance: 2000000, name: 'Inpatient Services' },
      { benefitCode: 'PMF-12', balance: 197000, name: 'Outpatient Services' },
    ]);
    expect(getAllPomsfBenefitBalances(pomsfBalance)).toEqual([
      { code: 'PMF-07', name: 'Inpatient Services', balance: 2000000 },
      { code: 'PMF-12', name: 'Outpatient Services', balance: 197000 },
    ]);
  });

  it('de-duplicates a benefit code that appears under more than one policy', () => {
    const pomsfBalance = {
      memberPolicies: [
        {
          benefit: [
            { benefitCode: 'PMF-12', name: 'Outpatient Services', balance: [{ member: 'self', balance: 197000 }] },
          ],
        },
        {
          benefit: [
            { benefitCode: 'PMF-12', name: 'Outpatient Services', balance: [{ member: 'self', balance: 500 }] },
          ],
        },
      ],
    } as unknown as PomsfBalance;
    expect(getAllPomsfBenefitBalances(pomsfBalance)).toEqual([
      { code: 'PMF-12', name: 'Outpatient Services', balance: 197000 },
    ]);
  });

  it('returns an empty list when there is no balance data yet', () => {
    expect(getAllPomsfBenefitBalances(null)).toEqual([]);
  });
});

describe('formatKes', () => {
  it('formats a positive amount with thousands separators and two decimals', () => {
    expect(formatKes(197000)).toBe('KES 197,000.00');
  });

  it('formats a zero balance explicitly', () => {
    expect(formatKes(0)).toBe('KES 0.00');
  });
});
