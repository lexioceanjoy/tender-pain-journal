import { findBodyRegion } from '../body-map/bodyRegions';
import { findPrecisionArea } from '../body-map/precisionAreas';
import { getAreaDetails, type PainEntry } from '../../shared/data/painEntry';

export type InsightSummary = {
  entries: PainEntry[];
  averageIntensity?: number;
  highPainEntries: number;
  commonRegions: Array<{ id: string; label: string; count: number; averageIntensity: number }>;
  commonPrecisionAreas: Array<{ id: string; label: string; count: number }>;
  commonActivities: Array<{ label: string; count: number }>;
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
    commonRegions: countRegions(selected).slice(0, 4),
    commonPrecisionAreas: countValues(selected.flatMap((entry) => entry.precisionAreas ?? []))
      .slice(0, 4)
      .map(({ value, count }) => ({ id: value, label: findPrecisionArea(value)?.label ?? value, count })),
    commonActivities: countValues(selected.flatMap((entry) => entry.context?.activities ?? []))
      .slice(0, 3)
      .map(({ value, count }) => ({ label: value, count }))
  };
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
