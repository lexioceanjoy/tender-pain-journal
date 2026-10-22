import { aiSummaryRequestSchema } from '../src/features/ai-summary/aiSummarySchema.js';
import {
  computeFindings, countWords, limitsSentence, MAX_NARRATIVE_WORDS, narrativeGate,
  type NarrativeFindings, type NarrativeGate
} from '../src/features/ai-summary/narrativeFindings.js';
import type { AiProvider, AiProviderConfig } from './providers/types.js';

export type NarrativeResult = { narrative: string } | { gate: NarrativeGate };

/** Identified by class; server/app.ts maps it to a fixed message. */
export class NarrativeTooLongError extends Error {
  constructor(readonly words: number, readonly discarded: string) {
    super(`The narrative was ${words} words; the limit is ${MAX_NARRATIVE_WORDS}.`);
    this.name = 'NarrativeTooLongError';
  }
}

export const TOO_LONG_NARRATIVE_MESSAGE = 'The AI narrative was longer than its limit and was discarded rather than shown.';

/** Validate, then either a fixed pre-gate message or the findings the provider would receive. */
export function prepareNarrative(untrustedPayload: unknown): { gate: NarrativeGate } | { findings: NarrativeFindings } {
  const payload = aiSummaryRequestSchema.parse(untrustedPayload);
  const gate = narrativeGate(payload);
  return gate ? { gate } : { findings: computeFindings(payload) };
}

export async function createAiNarrative(
  provider: AiProvider,
  untrustedPayload: unknown,
  safetyIdentifier: string,
  config: AiProviderConfig
): Promise<NarrativeResult> {
  const prepared = prepareNarrative(untrustedPayload);
  if ('gate' in prepared) return prepared;
  const text = await provider.createNarrative(prepared.findings, safetyIdentifier, config);
  const narrative = `${text.trim()}\n\n${limitsSentence(prepared.findings)}`;
  const words = countWords(narrative);
  if (words > MAX_NARRATIVE_WORDS) throw new NarrativeTooLongError(words, narrative);
  return { narrative };
}
