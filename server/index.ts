import { createServer } from 'node:http';
import { createRequestHandler, loadEnvLocal, resolveActiveProviderConfig } from './app.js';

const envLocal = loadEnvLocal();

let active: ReturnType<typeof resolveActiveProviderConfig>;
try {
  active = resolveActiveProviderConfig(envLocal);
} catch (error) {
  console.error(`Tender AI service cannot start: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const port = Number(process.env.TENDER_AI_PORT ?? 8787);

createServer(createRequestHandler(active)).listen(port, '127.0.0.1', () => {
  console.log(`Tender AI service ready at http://127.0.0.1:${port} (provider: ${active.provider.name})`);
});
