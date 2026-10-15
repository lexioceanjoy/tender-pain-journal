import type { IncomingMessage, ServerResponse } from 'node:http';
import { createRequestHandler } from '../server/app.js';
import { resolveActiveConfigSafely } from './_shared.js';

// Not passphrase-gated: this never calls the provider or costs money, it
// only reports which provider is configured and whether a key is present.
const active = resolveActiveConfigSafely();
const handle = active ? createRequestHandler(active) : undefined;

export default function handler(request: IncomingMessage, response: ServerResponse) {
  if (!handle) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.writeHead(503).end(JSON.stringify({ error: 'AI service is not configured.' }));
    return;
  }
  return handle(request, response);
}
