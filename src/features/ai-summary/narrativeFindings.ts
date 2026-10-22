import type { AiSummaryRequest } from './aiSummarySchema';

// Narrative v2 (docs/plans/narrative-v2.md): decide deterministically what
// is notable, so the model only puts these findings into words. Shared by
// the browser (pre-gate before anything is sent) and the server (source of
// truth). Type-only imports, so it also loads under Vercel's strict ESM.

type AiEntry = AiSummaryRequest['entries'][number];

// ---------------------------------------------------------------------------
// Thresholds. Starting points the narrative eval tests, not validated cut-offs.
// ---------------------------------------------------------------------------

export const MIN_ENTRIES_FOR_NARRATIVE = 3;
export const TREND_MIN_ENTRIES = 6;
/** Points on 0–10 between first- and second-half means. Farrar et al., Pain 2001. */
export const TREND_MIN_DELTA = 2.0;
export const ASSOCIATION_MIN_SUPPORT = 3;
export const ASSOCIATION_MIN_SUPPORT_SHARE = 0.2;
export const ASSOCIATION_MIN_MEAN_DIFF = 2.0;
export const MAX_ASSOCIATIONS = 3;
/** Same cut-off Insights uses for high-pain entries. */
export const HIGH_PAIN_THRESHOLD = 7;
export const OUTLIER_MIN_DEVIATION = 3;
export const MAX_OUTLIERS = 2;
export const RECURRING_MIN_ENTRIES = 3;
export const RECURRING_MIN_SHARE = 0.5;
export const FIRST_RECORDED_MIN_PRIOR_ENTRIES = 3;
export const MAX_OTHER_LABELS = 8;
export const DATA_GAP_MIN_DAYS = 7;
export const MAX_NOTES = 20;
/** Sensations listed per treatment: those logged on the same check-ins (descriptive, not a comparison). */
export const MAX_TREATMENT_SENSATIONS = 3;
/** Each side needs this many check-ins recording it (the association support minimum). */
export const SIDE_MIN_ENTRIES = ASSOCIATION_MIN_SUPPORT;
/** A side's top sensation must be on at least this share of that side's check-ins. */
export const SIDE_MIN_SHARE = 0.5;
/** Hard maximum for the whole narrative, limits sentence included. */
export const MAX_NARRATIVE_WORDS = 250;

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export type NarrativeGate = { reason: 'too-few-entries' | 'all-identical'; message: string };

export type FactorKind = 'location' | 'sensation' | 'activity' | 'sleep' | 'stress' | 'mood' | 'cycle';
type Group = { entries: number; mean: number; highCount: number };
type Half = { from: string; to: string; entries: number; mean: number };
type LabelFindings = {
  recurring: Array<{ label: string; entries: number }>;
  firstRecordedInRange: Array<{ label: string; date: string; entries: number }>;
  other: Array<{ label: string; entries: number }>;
};

/** Everything the AI provider receives. No per-entry records, times of day, or doses. */
export type NarrativeFindings = {
  range: { from: string; to: string; days: number };
  overview: { entryCount: number; daysWithEntries: number; intensity: { min: number; median: number; max: number } };
  trend: null | { direction: 'up' | 'down'; firstHalf: Half; secondHalf: Half };
  associations: Array<{ factor: { kind: FactorKind; label: string }; with: Group; without: Group }>;
  outliers: Array<{ date: string; intensity: number }>;
  locations: LabelFindings;
  sensations: LabelFindings;
  gaps: Array<{ lastCheckInBefore: string | null; nextCheckInAfter: string | null; daysWithoutCheckIns: number }>;
  /** Locations and sensations first recorded in range on the same date (2+ labels), reported together. */
  firstRecordedTogether: Array<{ date: string; locations: string[]; sensations: string[] }>;
  /** Present only when left and right check-ins each meet SIDE_MIN_ENTRIES and their top sensations differ. */
  sensationsBySide: Array<{ side: 'left' | 'right'; entries: number; sensation: string; sensationEntries: number }>;
  treatments: Array<{
    name: string;
    entries: number;
    perceivedEffects: Record<string, number>;
    /** Sensations recorded on the check-ins where this treatment was logged. */
    sensationsOnSameCheckIns: Array<{ label: string; entries: number }>;
  }>;
  notes: Array<{ date: string; text: string }>;
  omittedNotes: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The calendar date as written, in the check-in's own offset (see aiSummary.ts). */
export function entryDate(entry: Pick<AiEntry, 'occurredAt'>) {
  return entry.occurredAt.slice(0, 10);
}

function dayNumber(date: string) {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function mean(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function countWords(text: string) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function joinList(items: string[]) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function lowerFirst(label: string) {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/** Only entries whose own calendar date is inside the range, oldest first. */
export function entriesInRange(request: AiSummaryRequest): AiEntry[] {
  return request.entries
    .filter((entry) => entryDate(entry) >= request.from && entryDate(entry) <= request.to)
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
}

// ---------------------------------------------------------------------------
// Pre-gates: no AI call
// ---------------------------------------------------------------------------

function sameSet(a: string[] | undefined, b: string[] | undefined) {
  const left = [...new Set(a ?? [])].sort();
  const right = [...new Set(b ?? [])].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function medicationKey(entry: AiEntry) {
  return (entry.medications ?? []).map((medication) => `${medication.name.toLowerCase()}|${medication.perceivedEffect ?? ''}`);
}

function sameRecord(a: AiEntry, b: AiEntry) {
  return a.intensity === b.intensity
    && sameSet(a.locations, b.locations)
    && sameSet(a.refinedLocations, b.refinedLocations)
    && sameSet(a.sensations, b.sensations)
    && sameSet(a.activities, b.activities)
    && a.sleep === b.sleep && a.stress === b.stress && a.mood === b.mood && a.cycle === b.cycle
    && sameSet(medicationKey(a), medicationKey(b));
}

export function narrativeGate(request: AiSummaryRequest): NarrativeGate | null {
  const entries = entriesInRange(request);
  if (entries.length < MIN_ENTRIES_FOR_NARRATIVE) {
    return {
      reason: 'too-few-entries',
      message: `An AI summary needs at least ${MIN_ENTRIES_FOR_NARRATIVE} check-ins in this date range, and there `
        + `${entries.length === 1 ? 'is 1' : `are ${entries.length}`}. With fewer, there's no pattern to describe. `
        + 'Insights and the appointment export still show these records.'
    };
  }
  // A note is something new the person said, so it always lifts this gate.
  if (entries.every((entry) => !entry.note) && entries.every((entry) => sameRecord(entry, entries[0]))) {
    const first = entries[0];
    const places = joinList([...first.locations, ...(first.refinedLocations ?? [])].map(lowerFirst));
    const feel = first.sensations?.length ? `, described as ${joinList(first.sensations)}` : '';
    return {
      reason: 'all-identical',
      message: `All ${entries.length} check-ins in this range recorded the same thing: ${first.intensity}/10 in the ${places}${feel}. `
        + 'A summary would only repeat that. Was anything different on any of these days, such as sleep, activity, or how the pain felt? '
        + 'Adding it to a check-in gives the summary something to describe.'
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

const EFFECT_LABELS: Record<string, string> = { helped: 'helped', 'no-change': 'no change', 'not-sure': 'not sure yet' };

function factorsOf(entry: AiEntry): Array<{ kind: FactorKind; label: string }> {
  const factors: Array<{ kind: FactorKind; label: string }> = [
    ...[...entry.locations, ...(entry.refinedLocations ?? [])].map((label) => ({ kind: 'location' as const, label })),
    ...(entry.sensations ?? []).map((label) => ({ kind: 'sensation' as const, label })),
    ...(entry.activities ?? []).map((label) => ({ kind: 'activity' as const, label }))
  ];
  for (const kind of ['sleep', 'stress', 'mood', 'cycle'] as const) {
    const value = entry[kind];
    if (value) factors.push({ kind, label: value });
  }
  return factors;
}

function groupOf(values: number[]): Group {
  return { entries: values.length, mean: round1(mean(values)), highCount: values.filter((value) => value >= HIGH_PAIN_THRESHOLD).length };
}

function findTrend(entries: AiEntry[]): NarrativeFindings['trend'] {
  if (entries.length < TREND_MIN_ENTRIES) return null;
  const half = entries.length >> 1;
  const describe = (part: AiEntry[]): Half => ({
    from: entryDate(part[0]), to: entryDate(part[part.length - 1]), entries: part.length,
    mean: round1(mean(part.map((entry) => entry.intensity)))
  });
  const first = entries.slice(0, half);
  const second = entries.slice(entries.length - half);
  const delta = mean(second.map((entry) => entry.intensity)) - mean(first.map((entry) => entry.intensity));
  if (Math.abs(delta) < TREND_MIN_DELTA) return null;
  return { direction: delta > 0 ? 'up' : 'down', firstHalf: describe(first), secondHalf: describe(second) };
}

function findAssociations(entries: AiEntry[]): NarrativeFindings['associations'] {
  const support = Math.max(ASSOCIATION_MIN_SUPPORT, Math.ceil(ASSOCIATION_MIN_SUPPORT_SHARE * entries.length));
  const byFactor = new Map<string, { kind: FactorKind; label: string; indexes: Set<number> }>();
  entries.forEach((entry, index) => {
    for (const factor of factorsOf(entry)) {
      const key = `${factor.kind}:${factor.label}`;
      const current = byFactor.get(key) ?? { ...factor, indexes: new Set<number>() };
      current.indexes.add(index);
      byFactor.set(key, current);
    }
  });
  const candidates = [...byFactor.values()]
    .filter(({ indexes }) => indexes.size >= support && entries.length - indexes.size >= support)
    .map(({ kind, label, indexes }) => {
      const withValues = entries.filter((_, index) => indexes.has(index)).map((entry) => entry.intensity);
      const withoutValues = entries.filter((_, index) => !indexes.has(index)).map((entry) => entry.intensity);
      return { kind, label, diff: Math.abs(mean(withValues) - mean(withoutValues)), withValues, withoutValues };
    })
    .filter(({ diff }) => diff >= ASSOCIATION_MIN_MEAN_DIFF)
    .sort((a, b) => b.diff - a.diff || b.withValues.length - a.withValues.length || a.label.localeCompare(b.label));

  // One value per context field, so "poor sleep" and "good sleep" don't
  // report the same split twice.
  const seenFields = new Set<FactorKind>();
  const kept = candidates.filter(({ kind }) => {
    if (kind === 'location' || kind === 'sensation' || kind === 'activity') return true;
    if (seenFields.has(kind)) return false;
    seenFields.add(kind);
    return true;
  });
  return kept.slice(0, MAX_ASSOCIATIONS).map(({ kind, label, withValues, withoutValues }) => ({
    factor: { kind, label }, with: groupOf(withValues), without: groupOf(withoutValues)
  }));
}

function findOutliers(entries: AiEntry[], hasTrend: boolean): NarrativeFindings['outliers'] {
  // A trend's endpoints aren't outliers.
  if (hasTrend) return [];
  const middle = median(entries.map((entry) => entry.intensity));
  const outliers = entries.filter((entry) => Math.abs(entry.intensity - middle) >= OUTLIER_MIN_DEVIATION);
  // More than a couple is spread, not outliers.
  if (outliers.length > MAX_OUTLIERS) return [];
  return outliers.map((entry) => ({ date: entryDate(entry), intensity: entry.intensity }));
}

function findLabels(entries: AiEntry[], labelsOf: (entry: AiEntry) => string[]): LabelFindings {
  const seen = new Map<string, number[]>();
  entries.forEach((entry, index) => {
    for (const label of new Set(labelsOf(entry))) seen.set(label, [...(seen.get(label) ?? []), index]);
  });
  const result: LabelFindings = { recurring: [], firstRecordedInRange: [], other: [] };
  const firstAllowedIndex = Math.max(FIRST_RECORDED_MIN_PRIOR_ENTRIES, entries.length >> 1);
  const ordered = [...seen.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  for (const [label, indexes] of ordered) {
    if (indexes[0] >= firstAllowedIndex) {
      result.firstRecordedInRange.push({ label, date: entryDate(entries[indexes[0]]), entries: indexes.length });
    } else if (indexes.length >= RECURRING_MIN_ENTRIES && indexes.length / entries.length >= RECURRING_MIN_SHARE) {
      result.recurring.push({ label, entries: indexes.length });
    } else if (result.other.length < MAX_OTHER_LABELS) {
      result.other.push({ label, entries: indexes.length });
    }
  }
  return result;
}

function findGaps(entries: AiEntry[], from: string, to: string): NarrativeFindings['gaps'] {
  const dates = [...new Set(entries.map(entryDate))].sort();
  const gaps: NarrativeFindings['gaps'] = [];
  const leading = dayNumber(dates[0]) - dayNumber(from);
  if (leading >= DATA_GAP_MIN_DAYS) gaps.push({ lastCheckInBefore: null, nextCheckInAfter: dates[0], daysWithoutCheckIns: leading });
  for (let index = 1; index < dates.length; index += 1) {
    const between = dayNumber(dates[index]) - dayNumber(dates[index - 1]) - 1;
    if (between >= DATA_GAP_MIN_DAYS) gaps.push({ lastCheckInBefore: dates[index - 1], nextCheckInAfter: dates[index], daysWithoutCheckIns: between });
  }
  const trailing = dayNumber(to) - dayNumber(dates[dates.length - 1]);
  if (trailing >= DATA_GAP_MIN_DAYS) gaps.push({ lastCheckInBefore: dates[dates.length - 1], nextCheckInAfter: null, daysWithoutCheckIns: trailing });
  return gaps;
}

function findTreatments(entries: AiEntry[]): NarrativeFindings['treatments'] {
  const byName = new Map<string, NarrativeFindings['treatments'][number]>();
  for (const entry of entries) {
    for (const medication of entry.medications ?? []) {
      const key = medication.name.trim().toLowerCase();
      const current = byName.get(key) ?? { name: medication.name.trim(), entries: 0, perceivedEffects: {}, sensationsOnSameCheckIns: [] };
      current.entries += 1;
      for (const label of new Set(entry.sensations ?? [])) {
        const found = current.sensationsOnSameCheckIns.find((item) => item.label === label);
        if (found) found.entries += 1;
        else current.sensationsOnSameCheckIns.push({ label, entries: 1 });
      }
      if (medication.perceivedEffect) {
        const label = EFFECT_LABELS[medication.perceivedEffect] ?? medication.perceivedEffect;
        current.perceivedEffects[label] = (current.perceivedEffects[label] ?? 0) + 1;
      }
      byName.set(key, current);
    }
  }
  return [...byName.values()]
    .map((treatment) => ({
      ...treatment,
      sensationsOnSameCheckIns: treatment.sensationsOnSameCheckIns
        .sort((a, b) => b.entries - a.entries || a.label.localeCompare(b.label))
        .slice(0, MAX_TREATMENT_SENSATIONS)
    }))
    .sort((a, b) => b.entries - a.entries || a.name.localeCompare(b.name));
}

function findFirstRecordedTogether(locations: LabelFindings, sensations: LabelFindings): NarrativeFindings['firstRecordedTogether'] {
  const byDate = new Map<string, { date: string; locations: string[]; sensations: string[] }>();
  const add = (date: string) => byDate.get(date) ?? byDate.set(date, { date, locations: [], sensations: [] }).get(date)!;
  locations.firstRecordedInRange.forEach(({ label, date }) => add(date).locations.push(label));
  sensations.firstRecordedInRange.forEach(({ label, date }) => add(date).sensations.push(label));
  return [...byDate.values()]
    .filter((group) => group.locations.length + group.sensations.length >= 2)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function sideOf(label: string) {
  return /^left\b/i.test(label) ? 'left' as const : /^right\b/i.test(label) ? 'right' as const : null;
}

function findSensationsBySide(entries: AiEntry[]): NarrativeFindings['sensationsBySide'] {
  const sides = (['left', 'right'] as const).map((side) => {
    const recorded = entries.filter((entry) => [...entry.locations, ...(entry.refinedLocations ?? [])].some((label) => sideOf(label) === side));
    const counts = new Map<string, number>();
    recorded.forEach((entry) => new Set(entry.sensations ?? []).forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1)));
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    // A tie for the top sensation isn't a side-specific sensation.
    const top = ranked[0] && (!ranked[1] || ranked[1][1] < ranked[0][1]) ? ranked[0] : undefined;
    return { side, entries: recorded.length, top };
  });
  const [left, right] = sides;
  const qualifies = (item: typeof left) => item.entries >= SIDE_MIN_ENTRIES && item.top && item.top[1] / item.entries >= SIDE_MIN_SHARE;
  if (!qualifies(left) || !qualifies(right) || left.top![0] === right.top![0]) return [];
  return sides.map(({ side, entries: count, top }) => ({ side, entries: count, sensation: top![0], sensationEntries: top![1] }));
}

/** Call only when narrativeGate() returned null (at least MIN_ENTRIES_FOR_NARRATIVE in range). */
export function computeFindings(request: AiSummaryRequest): NarrativeFindings {
  const entries = entriesInRange(request);
  if (entries.length < MIN_ENTRIES_FOR_NARRATIVE) throw new Error('computeFindings needs entries that pass the pre-gate.');
  const intensities = entries.map((entry) => entry.intensity);
  const trend = findTrend(entries);
  const withNotes = entries.filter((entry) => entry.note).reverse();
  const locations = findLabels(entries, (entry) => [...entry.locations, ...(entry.refinedLocations ?? [])]);
  const sensations = findLabels(entries, (entry) => entry.sensations ?? []);
  return {
    range: { from: request.from, to: request.to, days: dayNumber(request.to) - dayNumber(request.from) + 1 },
    overview: {
      entryCount: entries.length,
      daysWithEntries: new Set(entries.map(entryDate)).size,
      intensity: { min: Math.min(...intensities), median: median(intensities), max: Math.max(...intensities) }
    },
    trend,
    associations: findAssociations(entries),
    outliers: findOutliers(entries, trend !== null),
    locations,
    sensations,
    firstRecordedTogether: findFirstRecordedTogether(locations, sensations),
    sensationsBySide: findSensationsBySide(entries),
    gaps: findGaps(entries, request.from, request.to),
    treatments: findTreatments(entries),
    notes: withNotes.slice(0, MAX_NOTES).map((entry) => ({ date: entryDate(entry), text: entry.note! })),
    omittedNotes: Math.max(0, withNotes.length - MAX_NOTES)
  };
}

// ---------------------------------------------------------------------------
// The one limits sentence, appended by the server
// ---------------------------------------------------------------------------

function contextPhrase(kind: FactorKind, label: string) {
  const value = label.toLowerCase().replace('-', ' ');
  switch (kind) {
    case 'activity': return value;
    case 'sleep': return `${value} sleep`;
    case 'stress': return `${value} stress`;
    case 'mood': return `${value} mood`;
    case 'cycle': return `the cycle phase (${value})`;
    default: return null;
  }
}

export function limitsSentence(findings: NarrativeFindings) {
  for (const association of findings.associations) {
    const phrase = contextPhrase(association.factor.kind, association.factor.label);
    if (phrase) return `This summary doesn't assess whether ${phrase} affected pain ratings.`;
  }
  if (findings.trend) return "This summary doesn't assess what affected the change in ratings.";
  return "This summary doesn't assess what affected these ratings.";
}
