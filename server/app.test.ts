import { EventEmitter } from 'node:events';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { createRequestHandler, loadEnvLocal, resolveActiveProviderConfig } from './app.js';
import type { AiProvider } from './providers/types.js';

function fakeRequest(opts: { method: string; url: string; body?: string; headers?: Record<string, string> }): IncomingMessage {
  const req = Object.assign(new EventEmitter(), {
    method: opts.method,
    url: opts.url,
    headers: opts.headers ?? {},
    async *[Symbol.asyncIterator]() {
      if (opts.body) yield Buffer.from(opts.body);
    }
  });
  return req as unknown as IncomingMessage;
}

function fakeResponse() {
  const state = { statusCode: 0, body: '' };
  const response = {
    setHeader() {},
    writeHead(status: number) {
      state.statusCode = status;
      return response;
    },
    end(body?: string) {
      state.body = body ?? '';
    }
  };
  return { response: response as unknown as ServerResponse, state };
}

function fakeProvider(overrides: Partial<AiProvider> = {}): AiProvider {
  return {
    name: 'anthropic',
    displayName: 'Anthropic',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    privacyNoticeUrl: 'https://example.com/privacy',
    retentionSummary: 'Retained for a limited period.',
    createNarrative: vi.fn().mockResolvedValue('A careful summary.'),
    safeError: vi.fn().mockReturnValue('The AI narrative could not be generated.'),
    ...overrides
  };
}

describe('loadEnvLocal', () => {
  it('returns an empty object when .env.local does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tender-env-'));
    expect(loadEnvLocal(dir)).toEqual({});
  });

  it('parses key=value pairs, skipping blanks/comments and stripping quotes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tender-env-'));
    writeFileSync(join(dir, '.env.local'), [
      '# a comment',
      '',
      'TENDER_AI_PROVIDER=anthropic',
      'ANTHROPIC_API_KEY="quoted-value"',
      "ANTHROPIC_MODEL='claude-sonnet-5-5'"
    ].join('\n'));

    expect(loadEnvLocal(dir)).toEqual({
      TENDER_AI_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'quoted-value',
      ANTHROPIC_MODEL: 'claude-sonnet-5-5'
    });
  });
});

describe('resolveActiveProviderConfig', () => {
  it('throws when TENDER_AI_PROVIDER is unset', () => {
    expect(() => resolveActiveProviderConfig({})).toThrow(/TENDER_AI_PROVIDER/);
  });

  it('throws when TENDER_AI_PROVIDER is unrecognized', () => {
    expect(() => resolveActiveProviderConfig({ TENDER_AI_PROVIDER: 'something-else' })).toThrow(/TENDER_AI_PROVIDER/);
  });

  it('reports no API key and the default model when the key env var is absent', () => {
    const resolved = resolveActiveProviderConfig({ TENDER_AI_PROVIDER: 'anthropic' });
    expect(resolved.provider.name).toBe('anthropic');
    expect(resolved.apiKey).toBeUndefined();
    expect(resolved.model).toBe('claude-sonnet-5-5');
  });

  it('reads the API key and model from the explicit config object, not ambient process.env', () => {
    const resolved = resolveActiveProviderConfig({
      TENDER_AI_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'from-env-local',
      ANTHROPIC_MODEL: 'claude-haiku-5-5'
    });
    expect(resolved.apiKey).toBe('from-env-local');
    expect(resolved.model).toBe('claude-haiku-5-5');
  });
});

describe('createRequestHandler', () => {
  it('reports ready: false and no secrets when the API key is missing', async () => {
    const provider = fakeProvider();
    const handler = createRequestHandler({ provider, apiKey: undefined, model: 'claude-sonnet-5-5' });
    const { response, state } = fakeResponse();

    await handler(fakeRequest({ method: 'GET', url: '/api/ai-provider-info' }), response);

    expect(state.statusCode).toBe(200);
    const body = JSON.parse(state.body);
    expect(body).toEqual({
      provider: 'anthropic',
      displayName: 'Anthropic',
      privacyNoticeUrl: 'https://example.com/privacy',
      retentionSummary: 'Retained for a limited period.',
      ready: false
    });
  });

  it('reports ready: true once the key is present, still with no key material', async () => {
    const provider = fakeProvider();
    const handler = createRequestHandler({ provider, apiKey: 'secret-key', model: 'claude-sonnet-5-5' });
    const { response, state } = fakeResponse();

    await handler(fakeRequest({ method: 'GET', url: '/api/ai-provider-info' }), response);

    const body = JSON.parse(state.body);
    expect(body.ready).toBe(true);
    expect(state.body).not.toContain('secret-key');
  });

  it('returns 503 for /api/ai-summary when the key is missing, naming the required env var', async () => {
    const provider = fakeProvider();
    const handler = createRequestHandler({ provider, apiKey: undefined, model: 'claude-sonnet-5-5' });
    const { response, state } = fakeResponse();

    await handler(fakeRequest({ method: 'POST', url: '/api/ai-summary', body: '{}' }), response);

    expect(state.statusCode).toBe(503);
    expect(JSON.parse(state.body).error).toBe('Local AI service needs ANTHROPIC_API_KEY.');
    expect(provider.createNarrative).not.toHaveBeenCalled();
  });

  it('returns the narrative for a valid request once the key is present', async () => {
    const provider = fakeProvider();
    const handler = createRequestHandler({ provider, apiKey: 'secret-key', model: 'claude-sonnet-5-5' });
    const { response, state } = fakeResponse();
    const payload = JSON.stringify({
      from: '2026-08-01',
      to: '2026-08-07',
      entries: [{ occurredAt: '2026-08-01T08:00:00.000Z', intensity: 7, locations: ['Left buttock'] }]
    });

    await handler(fakeRequest({ method: 'POST', url: '/api/ai-summary', body: payload }), response);

    expect(state.statusCode).toBe(200);
    expect(JSON.parse(state.body)).toEqual({ narrative: 'A careful summary.' });
    expect(provider.createNarrative).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-08-01', to: '2026-08-07' }),
      'tender-local-user',
      { apiKey: 'secret-key', model: 'claude-sonnet-5-5' }
    );
  });

  it('returns 400 on invalid diary payload without calling the provider', async () => {
    const provider = fakeProvider();
    const handler = createRequestHandler({ provider, apiKey: 'secret-key', model: 'claude-sonnet-5-5' });
    const { response, state } = fakeResponse();

    await handler(fakeRequest({ method: 'POST', url: '/api/ai-summary', body: '{"from":"not-a-date"}' }), response);

    expect(state.statusCode).toBe(400);
    expect(provider.createNarrative).not.toHaveBeenCalled();
  });

  it('returns 502 with the provider\'s safe error message when the provider call fails', async () => {
    const provider = fakeProvider({
      createNarrative: vi.fn().mockRejectedValue(new Error('secret provider detail')),
      safeError: vi.fn().mockReturnValue('The AI narrative could not be generated.')
    });
    const handler = createRequestHandler({ provider, apiKey: 'secret-key', model: 'claude-sonnet-5-5' });
    const { response, state } = fakeResponse();
    const payload = JSON.stringify({
      from: '2026-08-01',
      to: '2026-08-07',
      entries: [{ occurredAt: '2026-08-01T08:00:00.000Z', intensity: 7, locations: ['Left buttock'] }]
    });

    await handler(fakeRequest({ method: 'POST', url: '/api/ai-summary', body: payload }), response);

    expect(state.statusCode).toBe(502);
    expect(JSON.parse(state.body).error).toBe('The AI narrative could not be generated.');
    expect(state.body).not.toContain('secret provider detail');
  });

  it('returns 404 for any other route', async () => {
    const provider = fakeProvider();
    const handler = createRequestHandler({ provider, apiKey: 'secret-key', model: 'claude-sonnet-5-5' });
    const { response, state } = fakeResponse();

    await handler(fakeRequest({ method: 'GET', url: '/not-a-route' }), response);

    expect(state.statusCode).toBe(404);
  });
});
