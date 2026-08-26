import type { ShrAnyResource } from './shr.types';

/**
 * Best-effort resolver for SHR coding display text.
 *
 * Several SHR codings — vital-sign LOINC codes, secondary-survey body-region
 * and finding codes — arrive with a `code` but no `display` (e.g.
 * `{ system: "https://nshr-uat.sha.go.ke/fhir/CodeSystem/em-body-region",
 * code: "XA45A6" }`). The SHR's own convention is that `coding.system` is
 * itself a resolvable FHIR `CodeSystem` URL — `GET`-ing it returns the whole
 * code system, `content: "complete"`, with a `concept[]` of `{ code, display }`
 * pairs. Each of these systems is small (single digits to a few dozen
 * concepts), so this fetches one whole system per distinct `system` URL seen,
 * once, rather than looking up one code at a time.
 *
 * This is a *display convenience*, never a dependency: a slow, unreachable, or
 * failing terminology server must not block or fail the surrounding record
 * fetch, so every failure here is swallowed and callers keep showing the raw
 * code — exactly as before this existed.
 */

/** Only `system` URLs shaped like a directly-resolvable FHIR CodeSystem canonical URL are fetched —
 *  this excludes generic terminology systems (LOINC, UCUM, HL7's own CodeSystems) that don't
 *  publish their content at their canonical URL and would otherwise be fetched pointlessly. */
const RESOLVABLE_SYSTEM_PATTERN = /\/fhir\/CodeSystem\//;

const FETCH_TIMEOUT_MS = 6000;

/** system URL → (code → display). Populated lazily, kept for the life of the session. */
const codeSystemCache = new Map<string, Map<string, string>>();
/** system URL → in-flight fetch, so concurrent callers share one request instead of racing duplicates. */
const inFlight = new Map<string, Promise<Map<string, string>>>();

interface FhirCodeSystemConcept {
  code?: string;
  display?: string;
}

async function fetchCodeSystem(system: string): Promise<Map<string, string>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(system, {
      method: 'GET',
      headers: { Accept: 'application/fhir+json' },
      credentials: 'omit',
      signal: controller.signal,
    });
    if (!response.ok) {
      return new Map();
    }
    const body: { concept?: FhirCodeSystemConcept[] } = await response.json();
    const concepts = Array.isArray(body?.concept) ? body.concept : [];
    return new Map(
      concepts
        .filter((concept): concept is Required<FhirCodeSystemConcept> => Boolean(concept?.code && concept?.display))
        .map((concept) => [concept.code, concept.display]),
    );
  } catch {
    return new Map();
  } finally {
    clearTimeout(timeout);
  }
}

/** True for a bare FHIR `Coding` (has `system` + `code`, no `display`) worth resolving. */
function isUnresolvedCoding(value: unknown): value is { system: string; code: string } {
  const coding = value as Record<string, any>;
  return (
    Boolean(coding) &&
    typeof coding === 'object' &&
    typeof coding.system === 'string' &&
    typeof coding.code === 'string' &&
    !coding.display &&
    RESOLVABLE_SYSTEM_PATTERN.test(coding.system)
  );
}

/** Every distinct `system` URL of an unresolved coding found anywhere in `resources`. */
function collectUnresolvedSystems(resources: ShrAnyResource[]): Set<string> {
  const systems = new Set<string>();
  const seen = new Set<unknown>();

  const walk = (node: unknown, depth: number) => {
    if (!node || depth > 8) {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, depth + 1));
      return;
    }
    if (typeof node !== 'object') {
      return;
    }
    if (seen.has(node)) {
      return;
    }
    seen.add(node);

    if (isUnresolvedCoding(node)) {
      systems.add((node as { system: string }).system);
      return;
    }
    Object.values(node as Record<string, unknown>).forEach((value) => walk(value, depth + 1));
  };

  resources.forEach((resource) => walk(resource, 0));
  return systems;
}

/**
 * Warm the cache for every code system referenced (without a `display`) across `resources`.
 * Never throws and never rejects — a failed lookup just leaves that system unresolved.
 */
export async function primeCodeSystems(resources: ShrAnyResource[]): Promise<void> {
  const systems = Array.from(collectUnresolvedSystems(resources)).filter((system) => !codeSystemCache.has(system));
  await Promise.all(
    systems.map(async (system) => {
      const pending = inFlight.get(system) ?? fetchCodeSystem(system);
      inFlight.set(system, pending);
      const concepts = await pending;
      codeSystemCache.set(system, concepts);
      inFlight.delete(system);
    }),
  );
}

/** A code's display, if its `system` was primed and the code was found in it. */
export function lookupCodeDisplay(system?: string, code?: string): string | undefined {
  if (!system || !code) {
    return undefined;
  }
  return codeSystemCache.get(system)?.get(code);
}
