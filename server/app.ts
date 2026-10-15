import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ZodError } from 'zod';
import { createAiNarrative } from './aiService.js';
import { assertProviderRegistryIsConsentReady, resolveProvider } from './providers/index.js';
import type { AiProvider, ProviderName } from './providers/types.js';

const DEFAULT_MODEL: Record<ProviderName, string> = {
  openai: 'gpt-5.6-sol',
  anthropic: 'claude-sonnet-5-5'
};

// Read directly from .env.local rather than process.env: Node's
// --env-file loading does not override a variable already present in the
// inherited shell environment, so a stray ambient export sharing a key's
// name (e.g. ANTHROPIC_API_KEY set for an unrelated reason) would
// otherwise make `ready` falsely true even when .env.local configures
// nothing.
export function loadEnvLocal(cwd: string = process.cwd()): Record<string, string> {
  const path = resolve(cwd, '.env.local');
  if (!existsSync(path)) return {};
  const config: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
      value = value.slice(1, -1);
    }
    config[key] = value;
  }
  return config;
}

export interface ActiveProviderConfig {
  provider: AiProvider;
  apiKey: string | undefined;
  model: string;
}

// TENDER_AI_PROVIDER is read exactly once, by the caller, at startup —
// never from request input. Throws (does not default or guess) when the
// provider is unset/unrecognized, or when any registered provider's
// consent metadata is incomplete — the caller is responsible for turning
// that into a startup failure (see server/index.ts), not this function.
export function resolveActiveProviderConfig(env: Record<string, string>): ActiveProviderConfig {
  const provider = resolveProvider(env.TENDER_AI_PROVIDER);
  assertProviderRegistryIsConsentReady();
  const apiKey = env[provider.apiKeyEnvVar];
  const model = env[`${provider.name.toUpperCase()}_MODEL`] || DEFAULT_MODEL[provider.name];
  return { provider, apiKey, model };
}

const maxBytes = 250_000;

export function createRequestHandler({ provider, apiKey, model }: ActiveProviderConfig) {
  return async function handleRequest(request: IncomingMessage, response: ServerResponse) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (request.method === 'GET' && request.url === '/api/ai-provider-info') {
      response.writeHead(200).end(JSON.stringify({
        provider: provider.name,
        displayName: provider.displayName,
        privacyNoticeUrl: provider.privacyNoticeUrl,
        retentionSummary: provider.retentionSummary,
        ready: Boolean(apiKey)
      }));
      return;
    }

    if (request.method !== 'POST' || request.url !== '/api/ai-summary') {
      response.writeHead(404).end(JSON.stringify({ error: 'Not found.' }));
      return;
    }
    if (!apiKey) {
      response.writeHead(503).end(JSON.stringify({ error: `Local AI service needs ${provider.apiKeyEnvVar}.` }));
      return;
    }
    try {
      const body = await readJson(request);
      const safetyId = String(request.headers['x-tender-safety-id'] ?? '').slice(0, 128) || 'tender-local-user';
      const narrative = await createAiNarrative(provider, body, safetyId, { apiKey, model });
      response.writeHead(200).end(JSON.stringify({ narrative }));
    } catch (error) {
      const clientError = error instanceof SyntaxError || error instanceof ZodError;
      response.writeHead(clientError ? 400 : 502).end(JSON.stringify({
        error: clientError ? 'The selected diary data was invalid.' : provider.safeError(error)
      }));
    }
  };
}

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new SyntaxError('Request too large.');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
