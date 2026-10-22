import OpenAI from 'openai';
import type { AiProvider } from './types.js';
import { AI_SUMMARY_INSTRUCTIONS, narrativeInput, TRUNCATED_NARRATIVE_MESSAGE } from './instructions.js';

// Parity with AnthropicTruncatedResponseError: identified by class, never
// by message text, and never returned as partial text.
export class OpenAiTruncatedResponseError extends Error {
  constructor() {
    super('The OpenAI response was incomplete.');
    this.name = 'OpenAiTruncatedResponseError';
  }
}

type OpenAiFailure = {
  status?: number;
  code?: string;
  type?: string;
};

export const openaiProvider: AiProvider = {
  name: 'openai',
  displayName: 'OpenAI',
  apiKeyEnvVar: 'OPENAI_API_KEY',
  privacyNoticeUrl: 'https://developers.openai.com/api/docs/guides/your-data#default-usage-policies-by-endpoint',
  retentionSummary: 'OpenAI retains submitted data for a limited period, which may be longer in specific cases such as content flagged for safety review. See OpenAI’s current data policy, linked below, for exact terms.',

  async createNarrative(findings, safetyId, config) {
    const client = new OpenAI({ apiKey: config.apiKey });
    const response = await client.responses.create({
      model: config.model,
      store: false,
      safety_identifier: safetyId,
      reasoning: { effort: 'low', context: 'current_turn' },
      text: { verbosity: 'low' },
      instructions: AI_SUMMARY_INSTRUCTIONS,
      input: narrativeInput(findings)
    });
    // An incomplete response (output-token limit or similar) is discarded,
    // as Anthropic's max_tokens stop is, rather than shown cut off.
    if (response.status === 'incomplete') throw new OpenAiTruncatedResponseError();
    const narrative = response.output_text.trim();
    if (!narrative) throw new Error('The AI service returned an empty summary.');
    return narrative;
  },

  safeError(error) {
    if (error instanceof OpenAiTruncatedResponseError) return TRUNCATED_NARRATIVE_MESSAGE;
    const failure = error as OpenAiFailure;
    if (failure.code === 'credit_balance_exhausted') {
      return 'OpenAI API credits are required. Add credits in OpenAI billing, then try again.';
    }
    if (failure.code?.includes('spend_limit') || failure.type === 'insufficient_quota') {
      return 'OpenAI API quota is unavailable. Check billing and spend limits, then try again.';
    }
    if (failure.status === 401 || failure.status === 403) {
      return 'OpenAI could not authorize this API key. Check the key and its Model capabilities permission.';
    }
    if (failure.status === 404 || failure.code === 'model_not_found') {
      return 'The configured OpenAI model is unavailable to this API project.';
    }
    return 'The AI narrative could not be generated.';
  }
};
