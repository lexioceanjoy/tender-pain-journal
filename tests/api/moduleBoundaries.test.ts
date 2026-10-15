import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..', '..');
const read = (relativePath: string) => readFileSync(resolve(ROOT, relativePath), 'utf8');

// Regression guard for a real outage: server/aiService.ts once imported
// aiSummaryRequestSchema from aiSummary.ts, which also pulls in
// body-map label lookups via extensionless imports. Those resolve fine
// under Vite and tsx, but not under Vercel's strict-ESM serverless
// runtime, which crashed with ERR_MODULE_NOT_FOUND in production. The
// fix was splitting the schema into aiSummarySchema.ts with zero
// client-only dependencies — this test keeps that split from quietly
// regressing.
describe('server/api module boundaries', () => {
  it('aiSummarySchema.ts has no dependency on body-map or any other client-only module', () => {
    const source = read('src/features/ai-summary/aiSummarySchema.ts');
    expect(source).not.toMatch(/from ['"][^'"]*body-map[^'"]*['"]/);
    expect(source).not.toMatch(/localStorage/);
    expect(source).not.toMatch(/from ['"]\.\/aiSummary['"]/);
  });

  it('server/aiService.ts imports the schema-only module, never the client aggregator', () => {
    const source = read('server/aiService.ts');
    expect(source).toContain("from '../src/features/ai-summary/aiSummarySchema.js'");
    expect(source).not.toMatch(/from ['"]\.\.\/src\/features\/ai-summary\/aiSummary\.js['"]/);
  });

  it('server/providers/types.ts imports the schema-only module, never the client aggregator', () => {
    const source = read('server/providers/types.ts');
    expect(source).toContain("from '../../src/features/ai-summary/aiSummarySchema.js'");
    expect(source).not.toMatch(/from ['"]\.\.\/\.\.\/src\/features\/ai-summary\/aiSummary\.js['"]/);
  });
});
