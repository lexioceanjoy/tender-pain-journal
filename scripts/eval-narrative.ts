// Narrative evaluation harness (docs/plans/narrative-eval.md).
//
//   npm run eval:narrative -- --label baseline              dry run: no API calls
//   npm run eval:narrative -- --label baseline --confirm    live run: billed API calls
//   npm run eval:narrative -- --compare <beforeDir> <afterDir>
//
// Key handling: the provider key comes only from .env.local, read the same
// way the local AI server reads it (loadEnvLocal). The shell environment is
// never consulted, no key can be passed on the command line, the Vercel CLI
// is never called, and no key value is ever printed or written to results.
import { execFileSync } from 'node:child_process';
import { createHash, randomInt } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { loadEnvLocal, resolveActiveProviderConfig } from '../server/app';
import { AI_SUMMARY_INSTRUCTIONS } from '../server/providers/instructions';
import { checkNarrative } from '../eval/narrative/checks';
import { buildFixtureRequest, fixtureInputText, loadFixtures } from '../eval/narrative/fixtures';
import {
  buildCompareHtml, buildReviewHtml, buildSummaryMarkdown,
  type FixtureResult, type RunRecord, type SampleResult
} from '../eval/narrative/report';

const RESULTS_DIR = resolve('eval/narrative/results');
const SAFETY_ID = 'tender-narrative-eval';
const DEFAULT_SAMPLES = 3;

type Args =
  | { mode: 'run'; label: string; confirm: boolean; provider?: string; model?: string; samples: number }
  | { mode: 'compare'; before: string; after: string };

function parseArgs(argv: string[]): Args {
  const known = new Set(['--label', '--confirm', '--provider', '--model', '--samples', '--compare']);
  for (const arg of argv) {
    if (arg.startsWith('--') && !known.has(arg)) {
      // Deliberately no --key/--api-key: a key on the command line ends up
      // in shell history and process listings.
      throw new Error(`Unknown option ${arg}. Keys are read only from .env.local.`);
    }
  }
  const value = (flag: string) => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const compareIndex = argv.indexOf('--compare');
  if (compareIndex !== -1) {
    const [before, after] = argv.slice(compareIndex + 1, compareIndex + 3);
    if (!before || !after) throw new Error('Usage: --compare <beforeDir> <afterDir>');
    return { mode: 'compare', before, after };
  }
  const label = value('--label');
  if (!label || !/^[a-z0-9-]+$/i.test(label)) throw new Error('Pass --label <name> (letters, numbers, hyphens).');
  const samples = Number(value('--samples') ?? DEFAULT_SAMPLES);
  if (!Number.isInteger(samples) || samples < 1 || samples > 5) throw new Error('--samples must be 1 to 5.');
  return { mode: 'run', label, confirm: argv.includes('--confirm'), provider: value('--provider'), model: value('--model'), samples };
}

// `vercel env pull` writes the Vercel project's variables, including the
// public demo's key, into .env.local by default. Refuse to run on such a
// file rather than risk evaluating with (and billing) the demo key.
function assertLocalDevEnv() {
  const path = resolve('.env.local');
  if (!existsSync(path)) throw new Error('.env.local not found. Copy .env.example and add your local development key.');
  const raw = readFileSync(path, 'utf8');
  const env = loadEnvLocal();
  const vercelKeys = Object.keys(env).filter((key) => key.startsWith('VERCEL_') || key === 'TENDER_DEMO_PASSPHRASE');
  if (/created by vercel cli/i.test(raw) || vercelKeys.length) {
    throw new Error(
      '.env.local looks like it came from `vercel env pull` (found: '
      + `${vercelKeys.length ? vercelKeys.join(', ') : 'Vercel CLI header'}). `
      + 'The evaluation uses only a local development key; restore your own .env.local first.'
    );
  }
  return env;
}

function gitState() {
  try {
    const options = { encoding: 'utf8' as const, stdio: ['ignore', 'pipe', 'ignore'] as ['ignore', 'pipe', 'ignore'] };
    const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], options).trim();
    const dirty = execFileSync('git', ['status', '--porcelain'], options).trim().length > 0;
    return { commit, dirty };
  } catch {
    return { commit: 'unknown', dirty: false };
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function run(args: Extract<Args, { mode: 'run' }>) {
  const envLocal = assertLocalDevEnv();
  const providerName = args.provider ?? envLocal.TENDER_AI_PROVIDER;
  const env: Record<string, string> = { ...envLocal };
  if (providerName) env.TENDER_AI_PROVIDER = providerName;
  if (args.model && providerName) env[`${providerName.toUpperCase()}_MODEL`] = args.model;
  // Same resolution the local AI server uses at startup, fed only from
  // .env.local (plus explicit --provider/--model), never process.env.
  const { provider, apiKey, model } = resolveActiveProviderConfig(env);

  const fixtures = loadFixtures();
  const requests = fixtures.map((fixture) => ({ fixture, request: buildFixtureRequest(fixture) }));
  const calls = fixtures.length * args.samples;
  const git = gitState();
  const config = {
    provider: provider.name,
    model,
    instructionsSha256: createHash('sha256').update(AI_SUMMARY_INSTRUCTIONS).digest('hex'),
    gitCommit: git.commit,
    gitDirty: git.dirty
  };

  console.log(`Provider: ${provider.displayName}  Model: ${model}`);
  console.log(`Key ${provider.apiKeyEnvVar} in .env.local: ${apiKey ? 'present' : 'MISSING'}`);
  console.log(`Fixtures: ${fixtures.length}  Samples each: ${args.samples}  API calls: ${calls}`);
  console.log(`Git: ${git.commit}${git.dirty ? ' (uncommitted changes)' : ''}`);

  if (!args.confirm) {
    console.log('\nDry run: payloads built and validated, no API calls made.');
    console.log('Add --confirm to run the live evaluation (billed API calls).');
    return;
  }
  if (!apiKey) throw new Error(`${provider.apiKeyEnvVar} is not set in .env.local.`);

  const outDir = join(RESULTS_DIR, `${timestamp()}-${args.label}`);
  mkdirSync(outDir, { recursive: true });
  const record: RunRecord = { label: args.label, startedAt: new Date().toISOString(), config, samplesPerFixture: args.samples, fixtures: [] };

  for (const { fixture, request } of requests) {
    const samples: SampleResult[] = [];
    for (let sample = 1; sample <= args.samples; sample += 1) {
      let narrative: string | undefined;
      let error: string | undefined;
      try {
        narrative = await provider.createNarrative(request, SAFETY_ID, { apiKey, model });
      } catch (failure) {
        // safeError() maps to a fixed, non-leaking message; the raw error
        // is never printed or stored.
        error = provider.safeError(failure);
      }
      const report = checkNarrative({ narrative, error, expect: fixture.expect, range: fixture.range, inputText: fixtureInputText(request) });
      samples.push({ sample, narrative, error, report });
      // Terminal output is fixture ids and pass/fail only, never narrative
      // text or payloads.
      console.log(`${fixture.id} #${sample}: ${report.passed ? 'PASS' : `FAIL (${[...new Set(report.failures.map((finding) => finding.check))].join(', ')})`}`);
    }
    const result: FixtureResult = { id: fixture.id, purpose: fixture.purpose, request, samples, scoredSample: randomInt(1, args.samples + 1) };
    record.fixtures.push(result);
    // Written after every fixture so an interrupted run keeps what it has.
    writeFileSync(join(outDir, 'run.json'), `${JSON.stringify(record, null, 2)}\n`);
  }

  writeFileSync(join(outDir, 'summary.md'), buildSummaryMarkdown(record));
  writeFileSync(join(outDir, 'review.html'), buildReviewHtml(record));
  const passed = record.fixtures.reduce((count, fixture) => count + fixture.samples.filter((sample) => sample.report.passed).length, 0);
  console.log(`\nHard checks: ${passed} of ${calls} passed.`);
  console.log(`Results: ${outDir}`);
}

function compare(args: Extract<Args, { mode: 'compare' }>) {
  const read = (dir: string) => JSON.parse(readFileSync(join(resolve(dir), 'run.json'), 'utf8')) as RunRecord;
  const before = read(args.before);
  const after = read(args.after);
  const { html, key } = buildCompareHtml(before, after, () => randomInt(2) === 1);
  const outDir = join(RESULTS_DIR, `${timestamp()}-compare-${basename(resolve(args.before))}-vs-${basename(resolve(args.after))}`);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'review.html'), html);
  // Kept out of review.html so the reviewer can't see which side is which.
  writeFileSync(join(outDir, 'blind-key.json'), `${JSON.stringify({ before: args.before, after: args.after, pairs: key }, null, 2)}\n`);
  console.log(`Blinded review: ${join(outDir, 'review.html')}`);
  console.log('Open blind-key.json only after the scores are downloaded.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === 'compare') compare(args);
  else await run(args);
}

main().catch((error: unknown) => {
  // Messages only, never error objects: nothing here should ever be able
  // to echo a request or a key.
  console.error(error instanceof Error ? error.message : 'The evaluation failed.');
  process.exitCode = 1;
});
