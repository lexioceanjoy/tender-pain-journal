import { findBodyRegion } from '../body-map/bodyRegions';
import { findPrecisionArea } from '../body-map/precisionAreas';
import type { PainEntry } from '../../shared/data/painEntry';
import { aiSummaryRequestSchema, type AiSummaryRequest } from './aiSummarySchema';

export { aiSummaryRequestSchema, type AiSummaryRequest };

// Each check-in's time is sent in its local offset (same instant), so the
// server's calendar dates are the person's own: an 8 pm check-in west of
// UTC would otherwise land on the next day. Only dates reach the AI
// provider (narrativeFindings.ts); the offset stays with Tender's server.
export function withLocalOffset(iso: string, offsetMinutes = -new Date(iso).getTimezoneOffset()) {
  const date = new Date(iso);
  if (offsetMinutes === 0) return date.toISOString();
  const local = new Date(date.getTime() + offsetMinutes * 60_000).toISOString().slice(0, 23);
  const pad = (value: number) => String(value).padStart(2, '0');
  const size = Math.abs(offsetMinutes);
  return `${local}${offsetMinutes > 0 ? '+' : '-'}${pad(Math.floor(size / 60))}:${pad(size % 60)}`;
}

export function buildAiSummaryRequest(
  entries: PainEntry[],
  from: string,
  to: string,
  offsetMinutesAt: (iso: string) => number = (iso) => -new Date(iso).getTimezoneOffset()
): AiSummaryRequest {
  return aiSummaryRequestSchema.parse({
    from,
    to,
    entries: entries.map((entry) => ({
      occurredAt: withLocalOffset(entry.occurredAt, offsetMinutesAt(entry.occurredAt)),
      intensity: entry.intensity,
      locations: entry.regions.map((id) => findBodyRegion(id)?.label ?? id),
      refinedLocations: entry.precisionAreas?.map((id) => findPrecisionArea(id)?.label ?? id),
      sensations: entry.sensations,
      activities: entry.context?.activities,
      sleep: entry.context?.sleep,
      stress: entry.context?.stress,
      mood: entry.context?.mood,
      cycle: entry.context?.cycle,
      // Dose stays on the device: no summary needs it (narrative-v2 decision 3).
      medications: entry.context?.medications?.map(({ name, perceivedEffect }) => ({ name, perceivedEffect })),
      note: entry.note
    }))
  });
}

export function tenderSafetyId() {
  const key = 'tender-ai-safety-id';
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}
