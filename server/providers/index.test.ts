import { describe, expect, it } from 'vitest';
import { assertProviderRegistryIsConsentReady, resolveProvider } from './index.js';
import { providerConsentMetadataSchema } from './types.js';
import { openaiProvider } from './openaiProvider.js';
import { anthropicProvider } from './anthropicProvider.js';

describe('provider registry', () => {
  it('does not throw for the real registry', () => {
    expect(() => assertProviderRegistryIsConsentReady()).not.toThrow();
  });

  it('does not assert a specific day/year count in either real provider\'s retentionSummary', () => {
    // Intentional, per ADR 0009: a paraphrased number would go stale the
    // moment the provider's own terms change. These strings describe only
    // that retention is limited and can be longer in some cases.
    expect(openaiProvider.retentionSummary).not.toMatch(/\d/);
    expect(anthropicProvider.retentionSummary).not.toMatch(/\d/);
  });

  it('fails validation on an incomplete provider (won\'t boot on incomplete consent copy)', () => {
    const incomplete = { ...openaiProvider, retentionSummary: '' };
    expect(() => providerConsentMetadataSchema.parse(incomplete)).toThrow();
  });

  it('fails validation on a non-URL privacyNoticeUrl', () => {
    const invalid = { ...openaiProvider, privacyNoticeUrl: 'not-a-url' };
    expect(() => providerConsentMetadataSchema.parse(invalid)).toThrow();
  });

  it('resolveProvider throws for an unset or unrecognized provider name', () => {
    expect(() => resolveProvider(undefined)).toThrow(/TENDER_AI_PROVIDER/);
    expect(() => resolveProvider('something-else')).toThrow(/TENDER_AI_PROVIDER/);
  });

  it('resolveProvider returns the matching adapter', () => {
    expect(resolveProvider('anthropic')).toBe(anthropicProvider);
    expect(resolveProvider('openai')).toBe(openaiProvider);
  });
});
