import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function fakeRequest(opts: { method: string; url: string }): IncomingMessage {
  const req = Object.assign(new EventEmitter(), { method: opts.method, url: opts.url, headers: {} });
  return req as unknown as IncomingMessage;
}

function fakeResponse() {
  const state = { statusCode: 0, body: '' };
  const response = {
    setHeader() {},
    writeHead(status: number) { state.statusCode = status; return response; },
    end(body?: string) { state.body = body ?? ''; }
  };
  return { response: response as unknown as ServerResponse, state };
}

const ORIGINAL_ENV = { ...process.env };

describe('api/ai-provider-info', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('answers without any passphrase header, since it never calls the provider or costs money', async () => {
    process.env.TENDER_AI_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_API_KEY = 'secret-key';
    process.env.TENDER_DEMO_PASSPHRASE = 'test-demo-code';
    const { default: handler } = await import('./ai-provider-info.js');
    const { response, state } = fakeResponse();

    await handler(fakeRequest({ method: 'GET', url: '/api/ai-provider-info' }), response);

    expect(state.statusCode).toBe(200);
    expect(JSON.parse(state.body)).toMatchObject({ provider: 'anthropic', ready: true });
  });

  it('returns a clean 503, not a crash, when the provider is misconfigured', async () => {
    delete process.env.TENDER_AI_PROVIDER;
    const { default: handler } = await import('./ai-provider-info.js');
    const { response, state } = fakeResponse();

    await handler(fakeRequest({ method: 'GET', url: '/api/ai-provider-info' }), response);

    expect(state.statusCode).toBe(503);
  });
});
