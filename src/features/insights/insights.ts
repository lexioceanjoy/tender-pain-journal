import { findBodyRegion } from '../body-map/bodyRegions';
import { findPrecisionArea } from '../body-map/precisionAreas';
import {
  NO_MARKER_ACTIVITY, getAreaDetails, interferenceAreaOptions, interferenceOptions,
  type AreaPattern, type Interference, type InterferenceArea, type PainEntry
} from '../../shared/data/painEntry';

// Derived timing (docs/plans/check-in-gaps.md 3a). In-app only: these use
// check-ins before the chosen range, so they are never sent to the AI.
/** An area is "new" on a check-in if no earlier check-in recorded it in this many days. */
export const NEW_AREA_LOOKBACK_DAYS = 30;
/** A run of recordings ends after a gap of more than this many days. */
export const RUN_GAP_DAYS = 14;
const DAY_MS = 86_400_000;
/** Insights lists this many new areas, then "and N more". */
export const NEW_AREAS_SHOWN = 3;

export type InsightSummary = {
  entries: PainEntry[];
  averageIntensity?: number;
  highPainEntries: number;
  commonRegions: Array<RegionSummary>;
  commonPrecisionAreas: Array<{ id: string; label: string; count: number }>;
  commonActivities: Array<{ label: string; count: number; worse: number; helped: number }>;
  /** Areas first recorded in this range after at least NEW_AREA_LOOKBACK_DAYS without them. */
  newAreas: Array<{ id: string; label: string; firstRecorded: string }>;
  /** Every area recorded in the range is new (e.g. the first period of data), so "new" says nothing. */
  allAreasNew: boolean;
  /** Days with an answer; each day takes its highest recorded level. */
  interference?: { days: number; levels: Record<Interference, number>; areas: Array<{ area: InterferenceArea; days: number }> };
  /** Nights count once per day. "Of" is days with a sleep answer or "Pain woke me". */
  painWoke?: { nights: number; ofNights: number };
};

export type RegionSummary = {
  id: string;
  label: string;
  count: number;
  averageIntensity: number;
  /** Local date (YYYY-MM-DD) the current run started; see RUN_GAP_DAYS. */
  recordedSince?: string;
  daysRecordedSince?: number;
  daysInRun?: number;
  /** Set when at least half of this area's check-ins in range recorded a pattern. */
  mostlyPattern?: AreaPattern;
};

export function buildInsights(entries: PainEntry[], from: string, to: string): InsightSummary {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T23:59:59.999`);
  const selected = entries.filter((entry) => {
    const occurred = new Date(entry.occurredAt);
    return occurred >= start && occurred <= end;
  });

  return {
    entries: selected,
    averageIntensity: selected.length
      ? Number((selected.reduce((total, entry) => total + entry.intensity, 0) / selected.length).toFixed(1))
      : undefined,
    highPainEntries: selected.filter((entry) => entry.intensity >= 7).length,
    commonRegions: countRegions(selected).slice(0, 4).map((region) => ({
      ...region,
      ...recordedSince(entries, region.id, end),
      mostlyPattern: mostlyPattern(selected, region.id)
    })),
    commonPrecisionAreas: countValues(selected.flatMap((entry) => entry.precisionAreas ?? []))
      .slice(0, 4)
      .map(({ value, count }) => ({ id: value, label: findPrecisionArea(value)?.label ?? value, count })),
    commonActivities: countValues(selected.flatMap((entry) => entry.context?.activities ?? []))
      .slice(0, 3)
      .map(({ value, count }) => ({
        label: value,
        count,
        worse: value === NO_MARKER_ACTIVITY ? 0 : selected.filter((entry) => entry.context?.activityEffects?.[value] === 'worse').length,
        helped: value === NO_MARKER_ACTIVITY ? 0 : selected.filter((entry) => entry.context?.activityEffects?.[value] === 'helped').length
      })),
    newAreas: newAreas(entries, selected),
    allAreasNew: selected.length > 0 && newAreas(entries, selected).length === new Set(selected.flatMap(areaIds)).size,
    interference: interferenceDays(selected),
    painWoke: painWokeNights(selected)
  };
}

export function localDay(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function areaIds(entry: PainEntry) {
  return [...entry.regions, ...(entry.precisionAreas ?? [])];
}

function areaLabel(id: string) {
  return findBodyRegion(id)?.label ?? findPrecisionArea(id)?.label ?? id;
}

function newAreas(all: PainEntry[], selected: PainEntry[]) {
  const found = new Map<string, string>();
  for (const entry of [...selected].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
    const time = new Date(entry.occurredAt).getTime();
    for (const id of areaIds(entry)) {
      if (found.has(id)) continue;
      const seenRecently = all.some((other) => {
        const otherTime = new Date(other.occurredAt).getTime();
        return other.id !== entry.id && otherTime < time && time - otherTime <= NEW_AREA_LOOKBACK_DAYS * DAY_MS && areaIds(other).includes(id);
      });
      if (!seenRecently) found.set(id, localDay(entry.occurredAt));
    }
  }
  return [...found.entries()]
    .map(([id, firstRecorded]) => ({ id, label: areaLabel(id), firstRecorded }))
    .sort((a, b) => a.firstRecorded.localeCompare(b.firstRecorded) || a.label.localeCompare(b.label));
}

function recordedSince(all: PainEntry[], regionId: string, end: Date) {
  const times = all
    .filter((entry) => entry.regions.includes(regionId) && new Date(entry.occurredAt) <= end)
    .map((entry) => entry.occurredAt)
    .sort()
    .reverse();
  if (!times.length) return {};
  let start = times[0];
  for (const time of times.slice(1)) {
    if (new Date(start).getTime() - new Date(time).getTime() > RUN_GAP_DAYS * DAY_MS) break;
    start = time;
  }
  const run = times.filter((time) => time >= start);
  const days = new Set(run.map(localDay));
  const spanDays = Math.round((new Date(`${localDay(times[0])}T12:00:00`).getTime() - new Date(`${localDay(start)}T12:00:00`).getTime()) / DAY_MS) + 1;
  return { recordedSince: localDay(start), daysRecordedSince: days.size, daysInRun: spanDays };
}

function mostlyPattern(selected: PainEntry[], regionId: string): AreaPattern | undefined {
  const withRegion = selected.filter((entry) => entry.regions.includes(regionId));
  const patterns = withRegion.flatMap((entry) => entry.areaPatterns?.filter((item) => item.regionId === regionId) ?? []);
  if (!withRegion.length || patterns.length * 2 < withRegion.length) return undefined;
  const steady = patterns.filter((item) => item.pattern === 'steady').length;
  const comesAndGoes = patterns.length - steady;
  return steady === comesAndGoes ? undefined : steady > comesAndGoes ? 'steady' : 'comes-and-goes';
}

function interferenceDays(selected: PainEntry[]): InsightSummary['interference'] {
  const byDay = new Map<string, { level: Interference; areas: Set<InterferenceArea> }>();
  for (const entry of selected) {
    const level = entry.context?.interference;
    if (!level) continue;
    const day = localDay(entry.occurredAt);
    const current = byDay.get(day);
    const areas = current?.areas ?? new Set<InterferenceArea>();
    entry.context?.interferenceAreas?.forEach((area) => areas.add(area));
    const highest = !current || interferenceOptions.indexOf(level) > interferenceOptions.indexOf(current.level) ? level : current.level;
    byDay.set(day, { level: highest, areas });
  }
  if (!byDay.size) return undefined;
  const levels = Object.fromEntries(interferenceOptions.map((level) => [level, 0])) as Record<Interference, number>;
  byDay.forEach(({ level }) => { levels[level] += 1; });
  const areas = interferenceAreaOptions
    .map((area) => ({ area, days: [...byDay.values()].filter((day) => day.areas.has(area)).length }))
    .filter((item) => item.days > 0)
    .sort((a, b) => b.days - a.days);
  return { days: byDay.size, levels, areas };
}

function painWokeNights(selected: PainEntry[]): InsightSummary['painWoke'] {
  const answered = new Set<string>();
  const woke = new Set<string>();
  for (const entry of selected) {
    const day = localDay(entry.occurredAt);
    if (entry.context?.sleep || entry.context?.painWokeMe) answered.add(day);
    if (entry.context?.painWokeMe) woke.add(day);
  }
  return woke.size ? { nights: woke.size, ofNights: answered.size } : undefined;
}

function countRegions(entries: PainEntry[]) {
  const regions = new Map<string, { count: number; totalIntensity: number }>();
  entries.forEach((entry) => entry.regions.forEach((regionId) => {
    const current = regions.get(regionId) ?? { count: 0, totalIntensity: 0 };
    current.count += 1;
    current.totalIntensity += getAreaDetails(entry, regionId).intensity;
    regions.set(regionId, current);
  }));

  return [...regions.entries()]
    .map(([id, values]) => ({
      id,
      label: findBodyRegion(id)?.label ?? id,
      count: values.count,
      averageIntensity: Number((values.totalIntensity / values.count).toFixed(1))
    }))
    .sort((a, b) => b.count - a.count || b.averageIntensity - a.averageIntensity || a.label.localeCompare(b.label));
}

function countValues(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** "Oct 3" for a local YYYY-MM-DD date. */
export function formatShortDate(day: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${day}T12:00:00`));
}

export function regionTiming(region: RegionSummary) {
  const parts: string[] = [];
  if (region.recordedSince) {
    parts.push(`since ${formatShortDate(region.recordedSince)}`);
    if (region.daysInRun && region.daysInRun > 1) parts.push(`recorded on ${region.daysRecordedSince} of ${region.daysInRun} days`);
  }
  if (region.mostlyPattern) parts.push(region.mostlyPattern === 'steady' ? 'mostly steady' : 'mostly comes and goes');
  return parts.join(' · ');
}

export function activityMarkers(activity: { worse: number; helped: number }) {
  const parts = [
    activity.worse ? `marked as making it worse: ${activity.worse}×` : undefined,
    activity.helped ? `helped: ${activity.helped}×` : undefined
  ].filter(Boolean);
  return parts.join(', ');
}

/** What Insights shows under "New in this period": nothing when every area is new, else up to NEW_AREAS_SHOWN. */
export function newAreasForDisplay(summary: Pick<InsightSummary, 'newAreas' | 'allAreasNew'>) {
  if (summary.allAreasNew || summary.newAreas.length === 0) return null;
  return { shown: summary.newAreas.slice(0, NEW_AREAS_SHOWN), more: Math.max(0, summary.newAreas.length - NEW_AREAS_SHOWN) };
}
