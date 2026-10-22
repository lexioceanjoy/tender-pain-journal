import Anthropic from '@anthropic-ai/sdk';
import type { AiProvider } from './types.js';
import { AI_SUMMARY_INSTRUCTIONS, narrativeInput, TRUNCATED_NARRATIVE_MESSAGE } from './instructions.js';

// Identified by class, not by .message — a human-facing message is free to
// be reworded later without silently breaking the classification in
// safeError() below.
export class AnthropicTruncatedResponseError extends Error {
  constructor() {
    super('The Anthropic response was truncated at the max_tokens ceiling.');
    this.name = 'AnthropicTruncatedResponseError';
  }
}

export const anthropicProvider: AiProvider = {
  name: 'anthropic',
  displayName: 'Anthropic',
  apiKeyEnvVar: 'ANTHROPIC_API_KEY',
  privacyNoticeUrl: 'https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-personal-data',
  retentionSummary: 'Anthropic retains submitted data for a limited period, which may be longer in specific cases such as content flagged for safety review. See Anthropic’s current data policy, linked below, for exact terms.',

  async createNarrative(findings, safetyId, config) {
    const client = new Anthropic({ apiKey: config.apiKey });
    const response = await client.messages.create({
      model: config.model,
      // A safety net, not a length control. Length comes from the findings
      // input and the prompt's word target, and the server discards anything
      // over MAX_NARRATIVE_WORDS. A ~200-word answer is ~300 tokens, so 1536
      // should never be reached; a response that does reach it is rejected
      // below, not truncated and returned.
      max_tokens: 1536,
      system: AI_SUMMARY_INSTRUCTIONS,
      metadata: { user_id: safetyId },
      messages: [{
        role: 'user',
        content: narrativeInput(findings)
      }]
    });
    if (response.stop_reason === 'max_tokens') {
      // A clinician-facing narrative truncated mid-sentence is actively
      // misleading in a way no later fallback catches. Fail into
      // safeError (and the rule-based path) rather than hand someone half
      // a summary.
      throw new AnthropicTruncatedResponseError();
    }
    const narrative = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();
    if (!narrative) throw new Error('The AI service returned an empty summary.');
    return narrative;
  },

  safeError(error) {
    if (error instanceof AnthropicTruncatedResponseError) {
      return TRUNCATED_NARRATIVE_MESSAGE;
    }
    const failure = error as { status?: number; error?: { type?: string } };
    if (failure.status === 401 || failure.status === 403) {
      return 'Anthropic could not authorize this API key. Check the key and its permissions.';
    }
    if (failure.status === 429) {
      return 'Anthropic API quota or rate limit reached. Check billing and try again.';
    }
    if (failure.status === 404 || failure.error?.type === 'not_found_error') {
      return 'The configured Anthropic model is unavailable to this API account.';
    }
    return 'The AI narrative could not be generated.';
  }
};
