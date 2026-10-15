import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    writeHead(status: number) { state.statusCode = status; return response; },
    end(body?: string) { state.body = body ?? ''; }
  };
  return { response: response as unknown as ServerResponse, state };
}

const ORIGINAL_ENV = { ...process.env };

// Each test re-imports the module after setting process.env, because
// api/ai-summary.ts resolves its provider/passphrase once at module
// load — exactly like the Vercel runtime does per cold start. Lives
// under tests/api/, not api/, so Vercel never deploys this file as a
// function of its own.
describe('api/ai-summary', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('rejects any request when no demo passphrase is configured server-side', async () => {
    process.env.TENDER_AI_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_API_KEY = 'secret-key';
    delete process.env.TENDER_DEMO_PASSPHRASE;
    const { default: handler } = await import('../../api/ai-summary.js');
    const { response, state } = fakeResponse();

    await handler(fakeRequest({
      method: 'POST', url: '/api/ai-summary', headers: { 'x-tender-demo-passphrase': 'anything' }
    }), response);

    expect(state.statusCode).toBe(401);
  });

  it('rejects a missing or wrong passphrase, never leaking which', async () => {
    process.env.TENDER_AI_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_API_KEY = 'secret-key';
    process.env.TENDER_DEMO_PASSPHRASE = 'test-demo-code';
    const { default: handler } = await import('../../api/ai-summary.js');
    const { response, state } = fakeResponse();

    await handler(fakeRequest({ method: 'POST', url: '/api/ai-summary' }), response);

    expect(state.statusCode).toBe(401);
    expect(JSON.parse(state.body)).toEqual({ error: 'Passphrase required.' });
  });

  it('accepts the correct passphrase, tolerating incidental surrounding whitespace, and delegates to the shared handler', async () => {
    process.env.TENDER_AI_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_API_KEY = 'secret-key';
    process.env.TENDER_DEMO_PASSPHRASE = ' test-demo-code ';
    const { default: handler } = await import('../../api/ai-summary.js');
    const { response, state } = fakeResponse();

    await handler(fakeRequest({
      method: 'GET', url: '/not-a-route', headers: { 'x-tender-demo-passphrase': 'test-demo-code' }
    }), response);

    // Past the passphrase gate and into the shared server/app.ts handler,
    // which 404s any route it doesn't recognize — proves delegation, not
    // a passphrase rejection (that would be 401).
    expect(state.statusCode).toBe(404);
  });

  it('returns a clean 503, not a crash, when the provider is misconfigured', async () => {
    delete process.env.TENDER_AI_PROVIDER;
    process.env.TENDER_DEMO_PASSPHRASE = 'test-demo-code';
    const { default: handler } = await import('../../api/ai-summary.js');
    const { response, state } = fakeResponse();

    await handler(fakeRequest({
      method: 'POST', url: '/api/ai-summary', headers: { 'x-tender-demo-passphrase': 'test-demo-code' }
    }), response);

    expect(state.statusCode).toBe(503);
  });
});
