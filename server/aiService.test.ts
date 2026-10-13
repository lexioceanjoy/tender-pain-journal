import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { createAiNarrative } from './aiService.js';
import type { AiProvider } from './providers/types.js';

function fakeProvider(overrides: Partial<AiProvider> = {}): AiProvider {
  return {
    name: 'openai',
    displayName: 'OpenAI',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    privacyNoticeUrl: 'https://example.com/privacy',
    retentionSummary: 'Retained for a limited period.',
    createNarrative: vi.fn().mockResolvedValue('A careful summary.'),
    safeError: vi.fn().mockReturnValue('The AI narrative could not be generated.'),
    ...overrides
  };
}

describe('createAiNarrative orchestration', () => {
  it('rejects an invalid payload before calling the provider', async () => {
    const provider = fakeProvider();
    await expect(createAiNarrative(provider, { from: 'not-a-date' }, 'safety-id', { apiKey: 'key', model: 'model' }))
      .rejects.toBeInstanceOf(ZodError);
    expect(provider.createNarrative).not.toHaveBeenCalled();
  });

  it('forwards a valid payload to the provider unchanged', async () => {
    const provider = fakeProvider();
    const payload = {
      from: '2026-08-01',
      to: '2026-08-07',
      entries: [{
        occurredAt: '2026-08-01T08:00:00.000Z',
        intensity: 7,
        locations: ['Left buttock']
      }]
    };

    await expect(createAiNarrative(provider, payload, 'private-random-id', { apiKey: 'key', model: 'model' }))
      .resolves.toBe('A careful summary.');
    expect(provider.createNarrative).toHaveBeenCalledWith(payload, 'private-random-id', { apiKey: 'key', model: 'model' });
  });
});
