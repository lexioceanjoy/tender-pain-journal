import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { createAiNarrative, NarrativeTooLongError, prepareNarrative } from './aiService.js';
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

const config = { apiKey: 'key', model: 'model' };
const entry = (day: string, intensity: number, extra: Record<string, unknown> = {}) => ({
  occurredAt: `2026-08-${day}T08:00:00.000Z`, intensity, locations: ['Left buttock'], ...extra
});
const payload = {
  from: '2026-08-01',
  to: '2026-08-07',
  entries: [entry('01', 3), entry('03', 5, { note: 'Long drive.' }), entry('05', 6, { medications: [{ name: 'Ibuprofen', dose: '200 mg' }] })]
};

describe('createAiNarrative orchestration', () => {
  it('rejects an invalid payload before calling the provider', async () => {
    const provider = fakeProvider();
    await expect(createAiNarrative(provider, { from: 'not-a-date' }, 'safety-id', config)).rejects.toBeInstanceOf(ZodError);
    expect(provider.createNarrative).not.toHaveBeenCalled();
  });

  it('returns a pre-gate message without calling the provider', async () => {
    const provider = fakeProvider();
    const result = await createAiNarrative(provider, { ...payload, entries: payload.entries.slice(0, 2) }, 'safety-id', config);
    expect(result).toEqual({ gate: expect.objectContaining({ reason: 'too-few-entries' }) });
    expect(provider.createNarrative).not.toHaveBeenCalled();
  });

  it('sends the provider findings, never the records, and appends one limits sentence', async () => {
    const provider = fakeProvider();
    const result = await createAiNarrative(provider, payload, 'private-random-id', config);

    expect(result).toEqual({ narrative: "A careful summary.\n\nThis summary doesn't assess what affected these ratings." });
    const [findings, safetyId] = vi.mocked(provider.createNarrative).mock.calls[0];
    expect(safetyId).toBe('private-random-id');
    expect(findings.overview.entryCount).toBe(3);
    const sent = JSON.stringify(findings);
    expect(sent).not.toContain('occurredAt');
    expect(sent).not.toMatch(/T\d\d:\d\d/);
    expect(sent).not.toContain('200 mg');
    expect(findings.notes).toEqual([{ date: '2026-08-03', text: 'Long drive.' }]);
  });

  // The default limits sentence is 8 words, so 242 + 8 = 250 is the most allowed.
  const words = (count: number) => `${Array.from({ length: count }, () => 'word').join(' ')}.`;

  it('accepts a narrative at exactly 250 words, limits sentence included', async () => {
    const provider = fakeProvider({ createNarrative: vi.fn().mockResolvedValue(words(242)) });
    await expect(createAiNarrative(provider, payload, 'safety-id', config)).resolves.toHaveProperty('narrative');
  });

  it('discards a narrative at 251 words', async () => {
    const provider = fakeProvider({ createNarrative: vi.fn().mockResolvedValue(words(243)) });
    await expect(createAiNarrative(provider, payload, 'safety-id', config)).rejects.toBeInstanceOf(NarrativeTooLongError);
  });

  it('prepareNarrative gives the same gate or findings the service uses', () => {
    expect(prepareNarrative(payload)).toHaveProperty('findings');
    expect(prepareNarrative({ ...payload, entries: [payload.entries[0]] })).toHaveProperty('gate');
  });
});
