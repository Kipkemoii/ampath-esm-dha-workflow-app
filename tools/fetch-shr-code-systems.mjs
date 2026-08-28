/**
 * Regenerates `src/shr/shr-code-systems.json` — the offline copy of the SHR's
 * emergency-medicine FHIR CodeSystems, used to resolve display text for codings
 * the SHR sends bare (a `code` with no `display`).
 *
 * The app cannot fetch these at runtime: the O3 app shell's
 * Content-Security-Policy `connect-src` does not list the SHA FHIR server, so a
 * browser `fetch()` to it is blocked before it leaves the page. So we ship the
 * concepts instead. See `src/shr/shr-terminology.resource.ts`.
 *
 *   node ./tools/fetch-shr-code-systems.mjs [--server <url> | --server=<url>]
 *
 * Only the `em-*` systems are taken. They are the ones the SHR sends bare, and
 * they are the ones whose displays are written for clinicians. The rest of the
 * server's ~150 systems are deliberately left out: the big reference
 * catalogues (diagnoses, interventions, drugs) never arrive as bare codings,
 * and several of the small ones carry displays that are worse than humanising
 * the code would be — `knhts-contact-relationship-cs` maps `parent` to the
 * lowercase "parent", and `knhts-code-systems-cs` maps `loinc` to the URL
 * "http://loinc.org". Resolving against those would put wrong text in a
 * clinical view, which is worse than the raw code the viewer falls back to.
 *
 * Systems are keyed by CodeSystem **id** (the last path segment), not by full
 * URL, because the same system is published under different hosts across
 * environments (`nshr-uat.sha.go.ke`, `hie.go.ke`, production). The id must be
 * derived exactly as `codeSystemId()` does in `shr-terminology.resource.ts` —
 * the two are the halves of one key contract.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DEFAULT_SERVER = 'https://nshr-uat.sha.go.ke/fhir';
const WANTED_ID_PREFIX = 'em-';
const PAGE_SIZE = 200;
/** Guards against a server whose last page links to itself, which would spin forever. */
const MAX_PAGES = 50;

function parseServer(argv) {
  const inline = argv.find((arg) => arg.startsWith('--server='));
  if (inline) {
    return inline.slice('--server='.length);
  }
  const flag = argv.indexOf('--server');
  if (flag === -1) {
    return DEFAULT_SERVER;
  }
  const value = argv[flag + 1];
  if (!value || value.startsWith('-')) {
    throw new Error('--server needs a URL, e.g. --server https://nshr-uat.sha.go.ke/fhir');
  }
  return value;
}

/** Must match `codeSystemId()` in `src/shr/shr-terminology.resource.ts`. */
function codeSystemId(url) {
  return String(url ?? '')
    .split('/')
    .filter(Boolean)
    .pop();
}

const server = parseServer(process.argv.slice(2)).replace(/\/$/, '');
const outFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'shr', 'shr-code-systems.json');

const systems = {};
const canonicalById = {};
const seenPages = new Set();
const skipped = [];
let url = `${server}/CodeSystem?_count=${PAGE_SIZE}`;

while (url) {
  if (seenPages.has(url)) {
    throw new Error(`Pagination looped back to ${url}`);
  }
  if (seenPages.size >= MAX_PAGES) {
    throw new Error(`Stopped after ${MAX_PAGES} pages — the server's "next" links do not terminate.`);
  }
  seenPages.add(url);

  const response = await fetch(url, { headers: { Accept: 'application/fhir+json' } });
  if (!response.ok) {
    throw new Error(`GET ${url} -> ${response.status} ${response.statusText}`);
  }
  const bundle = await response.json();

  for (const { resource } of bundle.entry ?? []) {
    const canonical = resource?.url;
    const id = codeSystemId(canonical);
    if (!id) {
      skipped.push(`(no usable url: ${JSON.stringify(canonical)})`);
      continue;
    }
    if (!id.startsWith(WANTED_ID_PREFIX)) {
      continue;
    }
    // Two publishers minting the same id would silently overwrite each other and
    // put another system's wording on a clinical code, so refuse to guess.
    if (id in canonicalById && canonicalById[id] !== canonical) {
      throw new Error(`Two code systems share the id "${id}": ${canonicalById[id]} and ${canonical}`);
    }
    canonicalById[id] = canonical;

    const concepts = (resource?.concept ?? []).filter((concept) => concept?.code && concept?.display);
    if (concepts.length === 0) {
      skipped.push(`${id} (no concepts)`);
      continue;
    }
    systems[id] = Object.fromEntries(concepts.map(({ code, display }) => [code, display]));
  }

  const next = bundle.link?.find((link) => link.relation === 'next')?.url;
  // HAPI behind a reverse proxy can emit `next` on its internal base URL; following
  // that would silently walk off onto another host mid-run.
  if (next && !next.startsWith(server)) {
    throw new Error(`Refusing to follow a "next" link off ${server}: ${next}`);
  }
  url = next ?? null;
}

const sorted = Object.fromEntries(
  Object.keys(systems)
    .sort()
    .map((id) => [id, systems[id]]),
);
await writeFile(outFile, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');

const conceptCount = Object.values(sorted).reduce((total, concepts) => total + Object.keys(concepts).length, 0);
console.log(`Server: ${server}`);
console.log(
  `Wrote ${Object.keys(sorted).length} "${WANTED_ID_PREFIX}*" code systems (${conceptCount} concepts) to ${outFile}`,
);
if (skipped.length) {
  console.log(`Skipped: ${skipped.join(', ')}`);
}
