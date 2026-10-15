import { findBodyRegion } from '../body-map/bodyRegions';
import { findPrecisionArea } from '../body-map/precisionAreas';
import type { PainEntry } from '../../shared/data/painEntry';
import { aiSummaryRequestSchema, type AiSummaryRequest } from './aiSummarySchema';

export { aiSummaryRequestSchema, type AiSummaryRequest };

export function buildAiSummaryRequest(entries: PainEntry[], from: string, to: string): AiSummaryRequest {
  return aiSummaryRequestSchema.parse({
    from,
    to,
    entries: entries.map((entry) => ({
      occurredAt: entry.occurredAt,
      intensity: entry.intensity,
      locations: entry.regions.map((id) => findBodyRegion(id)?.label ?? id),
      refinedLocations: entry.precisionAreas?.map((id) => findPrecisionArea(id)?.label ?? id),
      sensations: entry.sensations,
      activities: entry.context?.activities,
      sleep: entry.context?.sleep,
      stress: entry.context?.stress,
      mood: entry.context?.mood,
      cycle: entry.context?.cycle,
      medications: entry.context?.medications,
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
