import OpenAI from 'openai';
import type { AiProvider } from './types.js';
import { AI_SUMMARY_INSTRUCTIONS } from './instructions.js';

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

  async createNarrative(payload, safetyId, config) {
    const client = new OpenAI({ apiKey: config.apiKey });
    const response = await client.responses.create({
      model: config.model,
      store: false,
      safety_identifier: safetyId,
      reasoning: { effort: 'low', context: 'current_turn' },
      text: { verbosity: 'low' },
      instructions: AI_SUMMARY_INSTRUCTIONS,
      input: `Date range: ${payload.from} to ${payload.to}\nDiary records (JSON):\n${JSON.stringify(payload.entries)}`
    });
    const narrative = response.output_text.trim();
    if (!narrative) throw new Error('The AI service returned an empty summary.');
    return narrative;
  },

  safeError(error) {
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
