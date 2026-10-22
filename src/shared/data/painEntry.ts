import { z } from 'zod';

export const sensationOptions = ['aching', 'sharp', 'burning', 'tight', 'tingling', 'numb', 'radiating'] as const;
export const sleepOptions = ['poor', 'okay', 'good'] as const;
export const stressOptions = ['low', 'medium', 'high'] as const;
export const moodOptions = ['low', 'neutral', 'good'] as const;
export const cycleOptions = ['period', 'pre-period', 'ovulation', 'post-period', 'other'] as const;
// Check-in gaps (docs/plans/check-in-gaps.md). All optional; never sent to the AI provider.
export const interferenceOptions = ['none', 'a-little', 'a-lot', 'unable'] as const;
export const interferenceAreaOptions = ['work', 'exercise', 'chores', 'social'] as const;
export const activityEffectOptions = ['worse', 'helped'] as const;
export const patternOptions = ['steady', 'comes-and-goes'] as const;
/** The one activity chip that never takes a marker: Sleep and "Pain woke me" cover it. */
export const NO_MARKER_ACTIVITY = 'Poor sleep';

export type Interference = typeof interferenceOptions[number];
export type InterferenceArea = typeof interferenceAreaOptions[number];
export type ActivityEffect = typeof activityEffectOptions[number];
export type AreaPattern = typeof patternOptions[number];

export const interferenceLabels: Record<Interference, string> = {
  none: 'No',
  'a-little': 'A little',
  'a-lot': 'A lot',
  unable: 'Couldn’t do usual things'
};
export const patternLabels: Record<AreaPattern, string> = { steady: 'Steady', 'comes-and-goes': 'Comes and goes' };
export const activityEffectLabels: Record<ActivityEffect, string> = { worse: 'made worse', helped: 'helped' };

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
  // 2 adds the check-in-gaps fields. Old entries stay 1 and are never rewritten.
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  occurredAt: z.string().datetime({ offset: true }),
  regions: z.array(z.string().min(1)).min(1),
  intensity: z.number().int().min(0).max(10),
  sensations: z.array(z.enum(sensationOptions)).optional(),
  areaDetails: z.array(areaDetailSchema).optional(),
  precisionAreas: z.array(z.string().startsWith('tender-detail-')).optional(),
  areaPatterns: z.array(z.object({ regionId: z.string().min(1), pattern: z.enum(patternOptions) })).optional(),
  context: z.object({
    activities: z.array(z.string().trim().min(1).max(80)).optional(),
    sleep: z.enum(sleepOptions).optional(),
    stress: z.enum(stressOptions).optional(),
    mood: z.enum(moodOptions).optional(),
    cycle: z.enum(cycleOptions).optional(),
    medications: z.array(medicationLogSchema).optional(),
    interference: z.enum(interferenceOptions).optional(),
    interferenceAreas: z.array(z.enum(interferenceAreaOptions)).optional(),
    activityEffects: z.record(z.string(), z.enum(activityEffectOptions)).optional(),
    painWokeMe: z.literal(true).optional()
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
  const patternIds = new Set<string>();
  entry.areaPatterns?.forEach((item, index) => {
    if (!entry.regions.includes(item.regionId)) {
      context.addIssue({ code: 'custom', path: ['areaPatterns', index, 'regionId'], message: 'Pattern must refer to a selected region' });
    }
    if (patternIds.has(item.regionId)) {
      context.addIssue({ code: 'custom', path: ['areaPatterns', index, 'regionId'], message: 'Pattern cannot be duplicated' });
    }
    patternIds.add(item.regionId);
  });
  const areas = entry.context?.interferenceAreas;
  if (areas?.length && entry.context?.interference !== 'a-lot' && entry.context?.interference !== 'unable') {
    context.addIssue({ code: 'custom', path: ['context', 'interferenceAreas'], message: 'Life areas need "a lot" or "couldn\'t do usual things"' });
  }
  if (areas && new Set(areas).size !== areas.length) {
    context.addIssue({ code: 'custom', path: ['context', 'interferenceAreas'], message: 'Life areas cannot be duplicated' });
  }
  Object.keys(entry.context?.activityEffects ?? {}).forEach((activity) => {
    if (activity === NO_MARKER_ACTIVITY || !entry.context?.activities?.includes(activity)) {
      context.addIssue({ code: 'custom', path: ['context', 'activityEffects', activity], message: 'Marker must refer to a selected activity other than Poor sleep' });
    }
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
  areaPatterns?: Array<{ regionId: string; pattern: AreaPattern }>;
  interference?: Interference;
  interferenceAreas?: InterferenceArea[];
  activityEffects?: Partial<Record<string, ActivityEffect>>;
  painWokeMe?: boolean;
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
    areaPatterns: input.areaPatterns?.length ? input.areaPatterns : undefined,
    context: {
      activities: input.activities?.length ? input.activities : undefined,
      sleep: input.sleep,
      stress: input.stress,
      mood: input.mood,
      cycle: input.cycle,
      medications,
      interference: input.interference,
      interferenceAreas: input.interference === 'a-lot' || input.interference === 'unable'
        ? input.interferenceAreas?.length ? input.interferenceAreas : undefined
        : undefined,
      activityEffects: activityEffects(input),
      painWokeMe: input.painWokeMe ? true as const : undefined
    },
    note: input.note?.trim() || undefined
  };
}

// Neutral is the absence of a key; markers only for selected activities.
function activityEffects(input: PainEntryInput) {
  const effects = Object.entries(input.activityEffects ?? {})
    .filter(([activity, effect]) => effect && activity !== NO_MARKER_ACTIVITY && input.activities?.includes(activity));
  return effects.length ? Object.fromEntries(effects) as Record<string, ActivityEffect> : undefined;
}

export function createPainEntry(input: PainEntryInput): PainEntry {
  const now = new Date().toISOString();
  return painEntrySchema.parse({
    id: crypto.randomUUID(),
    schemaVersion: 2,
    createdAt: now,
    updatedAt: now,
    ...entryContent(input)
  });
}

export function updatePainEntry(existing: PainEntry, input: PainEntryInput): PainEntry {
  return painEntrySchema.parse({
    ...existing,
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
    ...entryContent(input)
  });
}

export function repeatPainEntryInput(entry: PainEntry, occurredAt = new Date().toISOString()): PainEntryInput {
  return {
    regions: [...entry.regions],
    intensity: entry.intensity,
    occurredAt,
    sensations: entry.sensations ? [...entry.sensations] : undefined,
    areaDetails: entry.areaDetails?.map((detail) => ({
      regionId: detail.regionId,
      intensity: detail.intensity,
      sensations: detail.sensations ? [...detail.sensations] : undefined
    })),
    precisionAreas: entry.precisionAreas ? [...entry.precisionAreas] : undefined,
    // A property of the pain, like sensations; the one-off context fields are not copied.
    areaPatterns: entry.areaPatterns?.map((item) => ({ ...item }))
  };
}

export function getAreaDetails(entry: PainEntry, regionId: string) {
  const override = entry.areaDetails?.find((detail) => detail.regionId === regionId);
  return {
    intensity: override?.intensity ?? entry.intensity,
    sensations: override?.sensations ?? entry.sensations ?? []
  };
}
