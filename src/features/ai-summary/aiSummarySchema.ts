import { z } from 'zod';

// Deliberately has no import on anything under body-map/ or any other
// client-only module. server/aiService.ts and server/providers/types.ts
// import from here, not from ./aiSummary.ts — that file's
// buildAiSummaryRequest() pulls in body-map label lookups that don't
// resolve under Vercel's strict ESM serverless runtime (no extensionless
// relative imports there, unlike Vite's client bundle).
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
