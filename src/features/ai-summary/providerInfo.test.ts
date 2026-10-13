import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchProviderInfo, FALLBACK_PROVIDER_INFO } from './providerInfo';

describe('fetchProviderInfo', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the parsed metadata on a successful fetch', async () => {
    const info = {
      provider: 'anthropic',
      displayName: 'Anthropic',
      privacyNoticeUrl: 'https://example.com/privacy',
      retentionSummary: 'Retained for a limited period.',
      ready: true
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => info }));

    await expect(fetchProviderInfo()).resolves.toEqual(info);
  });

  it('falls back on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));

    await expect(fetchProviderInfo()).resolves.toEqual(FALLBACK_PROVIDER_INFO);
  });

  it('falls back when fetch rejects, without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(fetchProviderInfo()).resolves.toEqual(FALLBACK_PROVIDER_INFO);
  });

  it('falls back on a malformed response shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ narrative: 'not provider info' }) }));

    await expect(fetchProviderInfo()).resolves.toEqual(FALLBACK_PROVIDER_INFO);
  });
});
