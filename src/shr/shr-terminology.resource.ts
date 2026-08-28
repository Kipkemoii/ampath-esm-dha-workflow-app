import codeSystems from './shr-code-systems.json';

/**
 * Resolver for SHR coding display text.
 *
 * Several SHR codings — vital-sign LOINC codes, secondary-survey body-region
 * and finding codes — arrive with a `code` but no `display` (e.g.
 * `{ system: "https://nshr-uat.sha.go.ke/fhir/CodeSystem/em-body-region",
 * code: "XA45A6" }`). The SHR's own convention is that `coding.system` is
 * itself a resolvable FHIR `CodeSystem` URL, so those displays were once
 * fetched from it at runtime.
 *
 * They can't be. The O3 app shell serves a Content-Security-Policy whose
 * `connect-src` does not list the SHA FHIR server, so the browser blocks the
 * request before it is sent — no amount of retrying or CORS cooperation from
 * the server (which does send `Access-Control-Allow-Origin`) changes that, and
 * the policy is set by the hosting gateway, not by this module. Every SHR call
 * that works goes through `openmrsFetch` to the same-origin HIE proxy; there is
 * no proxy route for arbitrary terminology.
 *
 * So the concepts ship with the bundle instead — see
 * `tools/fetch-shr-code-systems.mjs`, which regenerates
 * `shr-code-systems.json` from the FHIR server's `em-*` code systems.
 *
 * This stays a *display convenience*, never a dependency: a code from a system
 * we don't carry, or one added upstream since the last regeneration, simply
 * resolves to `undefined` and callers keep showing the raw code — exactly as
 * they did when the fetch failed.
 */

/**
 * Systems are keyed by CodeSystem **id** — the last segment of the canonical
 * URL — rather than by the URL itself, because the same system is published
 * under a different host in each environment (`nshr-uat.sha.go.ke` in UAT,
 * `hie.go.ke` for a few, another host in production). Keying on the id makes a
 * single bundled copy correct everywhere.
 */
const conceptsBySystemId: Record<string, Record<string, string>> = codeSystems;

/**
 * Discarding the host also discards the resource type, so require the URL to
 * name a CodeSystem before trusting its last segment. Without this, a bare word
 * (`"em-body-region"`) or the ValueSet an IG conventionally publishes under the
 * same id (`.../fhir/ValueSet/em-body-region`) would resolve against the code
 * system's concepts.
 */
const CODE_SYSTEM_URL_PATTERN = /\/CodeSystem\/[^/]/;

/** `.../fhir/CodeSystem/em-body-region` → `em-body-region`. Mirrored in the generator. */
function codeSystemId(system: string): string | undefined {
  return system.split('/').filter(Boolean).pop();
}

/** A code's display, if we carry its code system and the code is in it. */
export function lookupCodeDisplay(system?: string, code?: string): string | undefined {
  if (!system || !code || !CODE_SYSTEM_URL_PATTERN.test(system)) {
    return undefined;
  }
  const id = codeSystemId(system);
  const display = id ? conceptsBySystemId[id]?.[code] : undefined;
  // `code` is payload data, so it can name something inherited from
  // `Object.prototype` (`constructor`, `toString`); those are not displays.
  return typeof display === 'string' ? display : undefined;
}
