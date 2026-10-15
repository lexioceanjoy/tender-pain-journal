import { findBodyRegion } from '../body-map/bodyRegions';
import { findPrecisionArea } from '../body-map/precisionAreas';
import type { PainEntry } from '../../shared/data/painEntry';

export type ExportableAreaDetail = {
  region: string;
  intensity?: number;
  sensations?: string[];
};

export type ExportableMedication = {
  name: string;
  dose?: string;
  perceivedEffect?: string;
};

export type ExportableEntry = {
  id: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  intensity: number;
  sensations: string[];
  regions: string[];
  precisionAreas: string[];
  areaDetails: ExportableAreaDetail[];
  activities: string[];
  sleep?: string;
  stress?: string;
  mood?: string;
  cycle?: string;
  medications: ExportableMedication[];
  note?: string;
};

// Human-readable throughout, never raw body-map IDs — reuses the same
// region/precision-area label lookups the AI payload builder uses
// (src/features/body-map/*), imported directly rather than through
// src/features/ai-summary/ so this feature has no dependency on that one.
export function toExportableEntry(entry: PainEntry): ExportableEntry {
  return {
    id: entry.id,
    occurredAt: entry.occurredAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    intensity: entry.intensity,
    sensations: entry.sensations ?? [],
    regions: entry.regions.map((id) => findBodyRegion(id)?.label ?? id),
    precisionAreas: (entry.precisionAreas ?? []).map((id) => findPrecisionArea(id)?.label ?? id),
    areaDetails: (entry.areaDetails ?? []).map((detail) => ({
      region: findBodyRegion(detail.regionId)?.label ?? detail.regionId,
      intensity: detail.intensity,
      sensations: detail.sensations
    })),
    activities: entry.context?.activities ?? [],
    sleep: entry.context?.sleep,
    stress: entry.context?.stress,
    mood: entry.context?.mood,
    cycle: entry.context?.cycle,
    medications: entry.context?.medications ?? [],
    note: entry.note
  };
}

export function buildExportJson(entries: PainEntry[]) {
  return JSON.stringify({
    app: 'Tender',
    exportedAt: new Date().toISOString(),
    entries: entries.map(toExportableEntry)
  }, null, 2);
}

const CSV_COLUMNS = [
  'id', 'occurredAt', 'createdAt', 'updatedAt', 'intensity', 'sensations',
  'regions', 'precisionAreas', 'areaDetails', 'activities', 'sleep',
  'stress', 'mood', 'cycle', 'medications', 'note'
] as const;

function csvField(value: string) {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function areaDetailsToText(details: ExportableAreaDetail[]) {
  return details.map((detail) => {
    const pieces: string[] = [];
    if (detail.intensity !== undefined) pieces.push(`${detail.intensity}/10`);
    if (detail.sensations?.length) pieces.push(detail.sensations.join(', '));
    return pieces.length ? `${detail.region} — ${pieces.join(', ')}` : detail.region;
  }).join('; ');
}

function medicationsToText(medications: ExportableMedication[]) {
  return medications.map((medication) => {
    const details = [medication.dose, medication.perceivedEffect].filter(Boolean).join(', ');
    return details ? `${medication.name} (${details})` : medication.name;
  }).join('; ');
}

function exportRowValues(row: ExportableEntry): Record<typeof CSV_COLUMNS[number], string> {
  return {
    id: row.id,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    intensity: String(row.intensity),
    sensations: row.sensations.join('; '),
    regions: row.regions.join('; '),
    precisionAreas: row.precisionAreas.join('; '),
    areaDetails: areaDetailsToText(row.areaDetails),
    activities: row.activities.join('; '),
    sleep: row.sleep ?? '',
    stress: row.stress ?? '',
    mood: row.mood ?? '',
    cycle: row.cycle ?? '',
    medications: medicationsToText(row.medications),
    note: row.note ?? ''
  };
}

export function buildExportCsv(entries: PainEntry[]) {
  const rows = entries.map((entry) => exportRowValues(toExportableEntry(entry)));
  const lines = [CSV_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((column) => csvField(row[column])).join(','));
  }
  return lines.join('\r\n');
}

export function exportFilename(format: 'json' | 'csv', date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `tender-export-${year}-${month}-${day}.${format}`;
}
