import { createServer } from 'node:http';
import OpenAI from 'openai';
import { ZodError } from 'zod';
import { createAiNarrative, safeAiError } from './aiService.js';

const port = Number(process.env.TENDER_AI_PORT ?? 8787);
const maxBytes = 250_000;

createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (request.method !== 'POST' || request.url !== '/api/ai-summary') {
    response.writeHead(404).end(JSON.stringify({ error: 'Not found.' }));
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    response.writeHead(503).end(JSON.stringify({ error: 'Local AI service needs OPENAI_API_KEY.' }));
    return;
  }
  try {
    const body = await readJson(request);
    const safetyId = String(request.headers['x-tender-safety-id'] ?? '').slice(0, 128) || 'tender-local-user';
    const narrative = await createAiNarrative(
      new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      body,
      safetyId,
      process.env.OPENAI_MODEL
    );
    response.writeHead(200).end(JSON.stringify({ narrative }));
  } catch (error) {
    const clientError = error instanceof SyntaxError || error instanceof ZodError;
    response.writeHead(clientError ? 400 : 502).end(JSON.stringify({
      error: clientError ? 'The selected diary data was invalid.' : safeAiError(error)
    }));
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Tender AI service ready at http://127.0.0.1:${port}`);
});

async function readJson(request: import('node:http').IncomingMessage) {
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
