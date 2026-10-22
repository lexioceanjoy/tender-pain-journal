import type { AreaPattern, PainEntry } from '../../shared/data/painEntry';
import type { ContextState } from '../entries/OptionalContext';

/** Per region, the pattern from the most recent earlier check-in that recorded one. */
export function patternPrefill(entries: PainEntry[], regions: string[], beforeIso: string, excludeId?: string) {
  const before = new Date(beforeIso).getTime();
  const earlier = entries
    .filter((entry) => entry.id !== excludeId && new Date(entry.occurredAt).getTime() < before)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const prefill: Record<string, AreaPattern> = {};
  for (const regionId of regions) {
    const pattern = earlier.flatMap((entry) => entry.areaPatterns ?? []).find((item) => item.regionId === regionId)?.pattern;
    if (pattern) prefill[regionId] = pattern;
  }
  return prefill;
}

/**
 * What gets stored. A person's own choice (or one edit/repeat loaded) is
 * saved; a pre-filled value only if Add context was opened during this
 * check-in (check-in-gaps decision 3), so the record never holds a value
 * the person didn't see.
 */
export function patternsToSave(
  regions: string[],
  context: Pick<ContextState, 'areaPatterns'>,
  prefill: Record<string, AreaPattern>,
  contextOpened: boolean
) {
  return regions.flatMap((regionId) => {
    const chosen = context.areaPatterns[regionId];
    const pattern = chosen === undefined ? (contextOpened ? prefill[regionId] : undefined) : chosen ?? undefined;
    return pattern ? [{ regionId, pattern }] : [];
  });
}
