import type { ShrResourceTypeConfig } from '../../config-schema';
import type { ShrAnyResource, ShrCodeableConcept, ShrCoding } from '../shr.types';
import { lookupCodeDisplay } from '../shr-terminology.resource';
import { humanise } from './shr-presentation';

/**
 * Grouping of SHR resources into the viewer's category tabs.
 *
 * FHIR does not model "kind of observation" as a resource type — every reading,
 * exam finding, lab result and questionnaire answer is an `Observation`, told
 * apart by `Observation.category`. R4 binds that element to the
 * `observation-category` value set (`social-history`, `vital-signs`, `imaging`,
 * `laboratory`, `procedure`, `survey`, `exam`, `therapy`, `activity`), but the
 * binding is *preferred*, not required, so an implementer may add their own
 * codes — and this SHR does: alongside the standard `vital-signs`, `exam` and
 * `survey`, its own `em-observation-category` system defines `caller-reported`
 * and `emt-assessed`.
 *
 * So the set of categories cannot be pinned down in config: a fixed list is
 * either incomplete now or goes stale the next time the SHR adds a profile, and
 * the failure mode is silent mislabelling — an imaging or triage observation
 * displayed under whichever category happened to be the catch-all. Instead,
 * config curates the categories worth naming and ordering deliberately, and
 * anything else present in the payload is discovered from the data and labelled
 * for what it actually is.
 */

export interface ShrCategory {
  resourceType: string;
  /** The `category` code this tab holds, when it is scoped to one. */
  categoryCode?: string;
  label: string;
  resources: ShrAnyResource[];
}

/** Every category coding on a resource that carries an actual code, in order. */
export function categoryCodings(resource: ShrAnyResource): ShrCoding[] {
  const concepts = (resource as any)?.category as ShrCodeableConcept[] | undefined;
  return (concepts ?? [])
    .flatMap((concept) => concept?.coding ?? [])
    .filter((coding): coding is ShrCoding => Boolean(coding?.code));
}

/** True when `resource.category[].coding[]` carries the given code, e.g. "vital-signs" or "exam". */
export function hasCategoryCode(resource: ShrAnyResource, code: string): boolean {
  return categoryCodings(resource).some((coding) => coding.code === code);
}

/**
 * Clinician-facing name for a category nobody configured a label for: what the
 * payload itself said, else the display from the coding's own code system, else
 * the code made readable ("social-history" → "Social history").
 *
 * The middle step is what turns this SHR's `caller-reported` into "Caller
 * reported", since its category system is one of the resolvable
 * `/fhir/CodeSystem/` URLs (see `shr-terminology.resource`). The standard HL7
 * system is deliberately not fetched — its codes already read correctly once
 * humanised, and that is not worth making a clinical view wait on hl7.org.
 */
function discoveredLabel(coding: ShrCoding): string {
  return coding.display?.trim() || lookupCodeDisplay(coding.system, coding.code) || humanise(coding.code);
}

/**
 * Bucket `resources` into display categories.
 *
 * Precedence, and why:
 *  1. Configured entries scoped to a `categoryCode` claim their matches first,
 *     in config order — so a site's curated wording and ordering always wins,
 *     and a resource carrying two configured codes lands in the earlier tab
 *     rather than an arbitrary one.
 *  2. A configured entry with no `categoryCode` is the type's catch-all. For a
 *     type nobody split by category it keeps its plain meaning of "everything of
 *     this type"; for a split type it means "carries no category at all", since
 *     coded leftovers are better served by (3) than by being folded into an
 *     unrelated label.
 *  3. Whatever is left carrying a category code becomes its own category, one
 *     per distinct code, labelled from the data. This is what keeps an
 *     unconfigured category (`survey`, `caller-reported`, a code added upstream
 *     tomorrow) visible and correctly named instead of mislabelled.
 *  4. Anything still unclaimed is emitted under `uncategorisedLabel`. Reachable
 *     only when a split type has no configured catch-all, and present so that a
 *     record can never be silently dropped from a health record view.
 *
 * Resource types absent from `configured` are not returned at all — the fetch
 * only asks for configured types, so anything else is not something the viewer
 * was asked to show.
 */
export function buildCategories(
  resources: ShrAnyResource[],
  configured: ShrResourceTypeConfig[],
  { uncategorisedLabel }: { uncategorisedLabel: string },
): ShrCategory[] {
  const byType = new Map<string, ShrAnyResource[]>();
  resources.forEach((resource) => {
    const type = resource?.resourceType;
    if (!type) {
      return;
    }
    const bucket = byType.get(type);
    if (bucket) {
      bucket.push(resource);
    } else {
      byType.set(type, [resource]);
    }
  });

  const claimed = new Set<ShrAnyResource>();
  const claimedBy = new Map<ShrResourceTypeConfig, ShrAnyResource[]>();
  /** Types the site has opted into splitting by category. */
  const splitTypes = new Set(configured.filter((c) => c.categoryCode).map((c) => c.resourceType));

  // (1) Configured, category-scoped entries.
  configured
    .filter((config) => config.categoryCode)
    .forEach((config) => {
      const pool = byType.get(config.resourceType) ?? [];
      const matched = pool.filter((r) => !claimed.has(r) && hasCategoryCode(r, config.categoryCode!));
      matched.forEach((r) => claimed.add(r));
      claimedBy.set(config, matched);
    });

  // (2) Configured catch-alls.
  configured
    .filter((config) => !config.categoryCode)
    .forEach((config) => {
      const pool = byType.get(config.resourceType) ?? [];
      const matched = pool.filter(
        (r) => !claimed.has(r) && (!splitTypes.has(config.resourceType) || categoryCodings(r).length === 0),
      );
      matched.forEach((r) => claimed.add(r));
      claimedBy.set(config, matched);
    });

  const categories: ShrCategory[] = configured.map((config) => ({
    resourceType: config.resourceType,
    categoryCode: config.categoryCode || undefined,
    label: config.label,
    resources: claimedBy.get(config) ?? [],
  }));

  // (3) Categories discovered in the data. Keyed by type + code; a resource
  // carrying several unconfigured codes is filed under its first, so that it
  // lands somewhere predictable rather than being duplicated across tabs.
  const discovered = new Map<string, { coding: ShrCoding; resourceType: string; resources: ShrAnyResource[] }>();
  byType.forEach((pool, type) => {
    if (!splitTypes.has(type)) {
      return;
    }
    pool.forEach((resource) => {
      if (claimed.has(resource)) {
        return;
      }
      const [coding] = categoryCodings(resource);
      if (!coding) {
        return;
      }
      claimed.add(resource);
      const key = `${type}|${coding.code}`;
      const bucket = discovered.get(key);
      if (bucket) {
        bucket.resources.push(resource);
      } else {
        discovered.set(key, { coding, resourceType: type, resources: [resource] });
      }
    });
  });

  categories.push(
    ...Array.from(discovered.values())
      .map((entry) => ({
        resourceType: entry.resourceType,
        categoryCode: entry.coding.code,
        label: discoveredLabel(entry.coding),
        resources: entry.resources,
      }))
      // Alphabetical, so a discovered tab's position doesn't shift with the
      // order resources happened to arrive in.
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  // (4) Safety net — see the precedence note above.
  byType.forEach((pool, type) => {
    if (!splitTypes.has(type)) {
      return;
    }
    const leftover = pool.filter((r) => !claimed.has(r));
    if (!leftover.length) {
      return;
    }
    leftover.forEach((r) => claimed.add(r));
    categories.push({ resourceType: type, label: uncategorisedLabel, resources: leftover });
  });

  return categories;
}
