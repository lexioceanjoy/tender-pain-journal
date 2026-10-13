import Anthropic from '@anthropic-ai/sdk';
import type { AiProvider } from './types.js';
import { AI_SUMMARY_INSTRUCTIONS } from './instructions.js';

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

  async createNarrative(payload, safetyId, config) {
    const client = new Anthropic({ apiKey: config.apiKey });
    const response = await client.messages.create({
      model: config.model,
      // A ceiling, not a length control. Output length is governed by
      // AI_SUMMARY_INSTRUCTIONS' "no more than 250 words" rule; 1024 gives
      // headroom so a well-behaved response is never cut off. A response
      // that does exhaust this budget is rejected below, not truncated and
      // returned.
      max_tokens: 1024,
      system: AI_SUMMARY_INSTRUCTIONS,
      metadata: { user_id: safetyId },
      messages: [{
        role: 'user',
        content: `Date range: ${payload.from} to ${payload.to}\nDiary records (JSON):\n${JSON.stringify(payload.entries)}`
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
      return 'The AI narrative could not finish safely within its length limit and was discarded rather than shown incomplete.';
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
