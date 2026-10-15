import type { IncomingMessage, ServerResponse } from 'node:http';
import { createRequestHandler } from '../server/app.js';
import { resolveActiveConfigSafely } from './_shared.js';

// Demo-deployment-only access control. Protects API spend, not health
// data — server/app.ts's handler (also used by npm run dev:ai) stays
// unaware of this header entirely, so local dev never needs a passphrase.
const PASSPHRASE_HEADER = 'x-tender-demo-passphrase';

const active = resolveActiveConfigSafely();
const handle = active ? createRequestHandler(active) : undefined;

export default function handler(request: IncomingMessage, response: ServerResponse) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');

  const expected = process.env.TENDER_DEMO_PASSPHRASE?.trim();
  const provided = String(request.headers[PASSPHRASE_HEADER] ?? '').trim();
  if (!expected || provided !== expected) {
    response.writeHead(401).end(JSON.stringify({ error: 'Passphrase required.' }));
    return;
  }
  if (!handle) {
    response.writeHead(503).end(JSON.stringify({ error: 'AI service is not configured.' }));
    return;
  }
  return handle(request, response);
}
