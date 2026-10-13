import { aiSummaryRequestSchema } from '../src/features/ai-summary/aiSummary.js';
import type { AiProvider, AiProviderConfig } from './providers/types.js';

export async function createAiNarrative(
  provider: AiProvider,
  untrustedPayload: unknown,
  safetyIdentifier: string,
  config: AiProviderConfig
) {
  const payload = aiSummaryRequestSchema.parse(untrustedPayload);
  return provider.createNarrative(payload, safetyIdentifier, config);
}
