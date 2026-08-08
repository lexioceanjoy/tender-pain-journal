import { z } from 'zod';
import { findBodyRegion } from '../body-map/bodyRegions';
import { findPrecisionArea } from '../body-map/precisionAreas';
import type { PainEntry } from '../../shared/data/painEntry';

const medicationSchema = z.object({
  name: z.string().max(120),
  dose: z.string().max(80).optional(),
  perceivedEffect: z.string().max(40).optional()
});

const aiEntrySchema = z.object({
  occurredAt: z.string().datetime({ offset: true }),
  intensity: z.number().int().min(0).max(10),
  locations: z.array(z.string().max(120)).max(74),
  refinedLocations: z.array(z.string().max(120)).max(20).optional(),
  sensations: z.array(z.string().max(40)).max(20).optional(),
  activities: z.array(z.string().max(80)).max(30).optional(),
  sleep: z.string().max(40).optional(),
  stress: z.string().max(40).optional(),
  mood: z.string().max(40).optional(),
  cycle: z.string().max(40).optional(),
  medications: z.array(medicationSchema).max(20).optional(),
  note: z.string().max(2000).optional()
});

export const aiSummaryRequestSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  entries: z.array(aiEntrySchema).min(1).max(500)
});

export type AiSummaryRequest = z.infer<typeof aiSummaryRequestSchema>;

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
