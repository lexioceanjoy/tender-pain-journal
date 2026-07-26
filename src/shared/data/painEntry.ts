import { z } from 'zod';

export const sensationOptions = ['aching', 'sharp', 'burning', 'tight', 'tingling', 'numb', 'radiating'] as const;
export const sleepOptions = ['poor', 'okay', 'good'] as const;
export const stressOptions = ['low', 'medium', 'high'] as const;
export const moodOptions = ['low', 'neutral', 'good'] as const;
export const cycleOptions = ['period', 'pre-period', 'ovulation', 'post-period', 'other'] as const;

export const medicationLogSchema = z.object({
  name: z.string().trim().min(1).max(120),
  dose: z.string().trim().max(80).optional(),
  perceivedEffect: z.enum(['helped', 'no-change', 'not-sure']).optional()
});

export const areaDetailSchema = z.object({
  regionId: z.string().min(1),
  intensity: z.number().int().min(0).max(10).optional(),
  sensations: z.array(z.enum(sensationOptions)).optional()
});

export const painEntrySchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(1),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  occurredAt: z.string().datetime({ offset: true }),
  regions: z.array(z.string().min(1)).min(1),
  intensity: z.number().int().min(0).max(10),
  sensations: z.array(z.enum(sensationOptions)).optional(),
  areaDetails: z.array(areaDetailSchema).optional(),
  precisionAreas: z.array(z.string().startsWith('tender-detail-')).optional(),
  context: z.object({
    activities: z.array(z.string().trim().min(1).max(80)).optional(),
    sleep: z.enum(sleepOptions).optional(),
    stress: z.enum(stressOptions).optional(),
    mood: z.enum(moodOptions).optional(),
    cycle: z.enum(cycleOptions).optional(),
    medications: z.array(medicationLogSchema).optional()
  }).optional(),
  note: z.string().trim().max(2000).optional()
}).superRefine((entry, context) => {
  const detailIds = new Set<string>();
  entry.areaDetails?.forEach((detail, index) => {
    if (!entry.regions.includes(detail.regionId)) {
      context.addIssue({
        code: 'custom',
        path: ['areaDetails', index, 'regionId'],
        message: 'Area detail must refer to a selected region'
      });
    }
    if (detailIds.has(detail.regionId)) {
      context.addIssue({
        code: 'custom',
        path: ['areaDetails', index, 'regionId'],
        message: 'Area detail cannot be duplicated'
      });
    }
    detailIds.add(detail.regionId);
  });
  if (entry.precisionAreas && new Set(entry.precisionAreas).size !== entry.precisionAreas.length) {
    context.addIssue({
      code: 'custom',
      path: ['precisionAreas'],
      message: 'Refined locations cannot be duplicated'
    });
  }
});

export type PainEntry = z.infer<typeof painEntrySchema>;
export type Sensation = typeof sensationOptions[number];

export type PainEntryInput = {
  regions: string[];
  intensity: number;
  occurredAt?: string;
  sensations?: Sensation[];
  activities?: string[];
  sleep?: typeof sleepOptions[number];
  stress?: typeof stressOptions[number];
  mood?: typeof moodOptions[number];
  cycle?: typeof cycleOptions[number];
  medication?: { name: string; dose?: string; perceivedEffect?: 'helped' | 'no-change' | 'not-sure' };
  areaDetails?: Array<{ regionId: string; intensity?: number; sensations?: Sensation[] }>;
  precisionAreas?: string[];
  note?: string;
};

function entryContent(input: PainEntryInput) {
  const medications = input.medication?.name.trim() ? [{
    name: input.medication.name.trim(),
    dose: input.medication.dose?.trim() || undefined,
    perceivedEffect: input.medication.perceivedEffect
  }] : undefined;

  return {
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    regions: input.regions,
    intensity: input.intensity,
    sensations: input.sensations?.length ? input.sensations : undefined,
    areaDetails: input.areaDetails?.length ? input.areaDetails : undefined,
    precisionAreas: input.precisionAreas?.length ? input.precisionAreas : undefined,
    context: {
      activities: input.activities?.length ? input.activities : undefined,
      sleep: input.sleep,
      stress: input.stress,
      mood: input.mood,
      cycle: input.cycle,
      medications
    },
    note: input.note?.trim() || undefined
  };
}

export function createPainEntry(input: PainEntryInput): PainEntry {
  const now = new Date().toISOString();
  return painEntrySchema.parse({
    id: crypto.randomUUID(),
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    ...entryContent(input)
  });
}

export function updatePainEntry(existing: PainEntry, input: PainEntryInput): PainEntry {
  return painEntrySchema.parse({
    ...existing,
    updatedAt: new Date().toISOString(),
    ...entryContent(input)
  });
}

export function getAreaDetails(entry: PainEntry, regionId: string) {
  const override = entry.areaDetails?.find((detail) => detail.regionId === regionId);
  return {
    intensity: override?.intensity ?? entry.intensity,
    sensations: override?.sensations ?? entry.sensations ?? []
  };
}
