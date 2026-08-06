import { type Scheme } from '../types';
import { type PomsfBalance } from '../../claims';

// POMSF's balance is split across two benefit lines by care setting: PMF-07 is
// Inpatient Services, PMF-12 is Outpatient Services. The registration form only
// captures Visit type (Outpatient/Inpatient), so that's the only signal available
// to decide which line's balance to surface.
const POMSF_BENEFIT_CODE_BY_VISIT_TYPE: Record<string, string> = {
  Outpatient: 'PMF-12',
  Inpatient: 'PMF-07',
};

export function isPomsfActive(schemes: Scheme[]): boolean {
  const pomsfScheme = schemes.find((s) => /pomsf/i.test(s.schemeName));
  return !!pomsfScheme && pomsfScheme.coverage?.status === '1';
}

export function findPomsfBenefitBalance(
  pomsfBalance: PomsfBalance | null | undefined,
  benefitCode: string | null,
): number | null {
  if (!pomsfBalance || !benefitCode) {
    return null;
  }
  for (const memberPolicy of pomsfBalance.memberPolicies ?? []) {
    const benefit = memberPolicy.benefit?.find((b) => b.benefitCode === benefitCode);
    if (benefit) {
      return benefit.balance?.[0]?.balance ?? null;
    }
  }
  return null;
}

// Resolves the balance for the current Visit type, or null if nothing should
// render (POMSF isn't Active, Visit type isn't picked yet, or no matching
// benefit line exists in the response). Deliberately independent of which
// scheme is selected in the Insurance scheme dropdown — the Eligibility row
// lists every active scheme regardless of selection (see workflow-drawer),
// so this resolves once POMSF is Active and callers decide where to show it.
export function getPomsfDisplayBalance(
  schemes: Scheme[],
  visitType: string,
  pomsfBalance: PomsfBalance | null | undefined,
): number | null {
  if (!isPomsfActive(schemes)) {
    return null;
  }
  const benefitCode = POMSF_BENEFIT_CODE_BY_VISIT_TYPE[visitType] ?? null;
  return findPomsfBenefitBalance(pomsfBalance, benefitCode);
}

export function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface PomsfBenefitBalance {
  code: string;
  name: string;
  balance: number | null;
}

// Every benefit line in the /pomsf-balance response (not just the one matching
// the current Visit type), for showing the full breakdown. De-duplicated by
// benefit code in case the same benefit appears under more than one policy.
export function getAllPomsfBenefitBalances(pomsfBalance: PomsfBalance | null | undefined): PomsfBenefitBalance[] {
  const byCode = new Map<string, PomsfBenefitBalance>();
  for (const memberPolicy of pomsfBalance?.memberPolicies ?? []) {
    for (const benefit of memberPolicy.benefit ?? []) {
      if (!byCode.has(benefit.benefitCode)) {
        byCode.set(benefit.benefitCode, {
          code: benefit.benefitCode,
          name: benefit.name,
          balance: benefit.balance?.[0]?.balance ?? null,
        });
      }
    }
  }
  return Array.from(byCode.values());
}
