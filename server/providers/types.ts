import { z } from 'zod';
import type { AiSummaryRequest } from '../../src/features/ai-summary/aiSummarySchema.js';

export type ProviderName = 'openai' | 'anthropic';

export interface AiProviderConfig {
  apiKey: string;
  model: string;
}

// The server must never boot with an incomplete consent disclosure — a
// half-filled consent box is worse than refusing to start. This schema is
// the startup-time gate: non-empty, and (for the URL) syntactically
// well-formed. It cannot verify privacyNoticeUrl actually resolves to the
// provider's current page — see ADR 0009 for that manual check.
export const providerConsentMetadataSchema = z.object({
  name: z.enum(['openai', 'anthropic']),
  displayName: z.string().min(1),
  privacyNoticeUrl: z.string().url(),
  retentionSummary: z.string().min(1),
  apiKeyEnvVar: z.string().min(1)
});

export interface AiProvider extends z.infer<typeof providerConsentMetadataSchema> {
  createNarrative(
    payload: AiSummaryRequest,
    safetyId: string,
    config: AiProviderConfig
  ): Promise<string>;

  /** Map a provider-specific failure to a safe, actionable, non-leaking message. */
  safeError(error: unknown): string;
}
