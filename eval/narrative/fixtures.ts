import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { buildAiSummaryRequest, type AiSummaryRequest } from '../../src/features/ai-summary/aiSummary';
import { createPainEntry, type PainEntryInput } from '../../src/shared/data/painEntry';

// Fixtures are synthetic by construction (docs/plans/narrative-eval.md):
// never real diary data, never an IndexedDB export or a backup file.
export const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

const mustMentionSchema = z.object({
  fact: z.string().min(1),
  any: z.array(z.string().min(1)).min(1)
});

export const fixtureSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  purpose: z.string().min(1),
  range: z.object({ from: z.iso.date(), to: z.iso.date() }),
  // Validated for real by createPainEntry() in buildFixtureRequest().
  entries: z.array(z.record(z.string(), z.unknown())).min(1),
  expect: z.object({
    mustMention: z.array(mustMentionSchema),
    mustNotMention: z.array(z.string().min(1)),
    intensityValues: z.array(z.number().int().min(0).max(10)).min(1),
    sides: z.array(z.enum(['left', 'right'])),
    entryCount: z.number().int().min(1),
    canaries: z.array(z.string().min(1)).optional()
  })
});

export type Fixture = z.infer<typeof fixtureSchema>;
export type FixtureExpect = Fixture['expect'];

export function loadFixtures(dir: string = FIXTURES_DIR): Fixture[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const fixture = fixtureSchema.parse(JSON.parse(readFileSync(join(dir, name), 'utf8')));
      if (`${fixture.id}.json` !== name) {
        throw new Error(`Fixture ${name} has id "${fixture.id}"; the id must match the file name.`);
      }
      return fixture;
    });
}

// Same path the app takes: PainEntryInput -> createPainEntry ->
// buildAiSummaryRequest, newest first like InsightsPanel's entries, so the
// evaluation also covers the payload builder and its label lookups.
export function buildFixtureRequest(fixture: Fixture): AiSummaryRequest {
  const entries = fixture.entries
    .map((input) => createPainEntry(input as PainEntryInput))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return buildAiSummaryRequest(entries, fixture.range.from, fixture.range.to);
}

// Text from the person's own records. A Tier 1 term that also appears
// here (e.g. "sciatica" in a note) is downgraded to a reviewer flag.
export function fixtureInputText(request: AiSummaryRequest) {
  return request.entries
    .flatMap((entry) => [
      entry.note ?? '',
      ...(entry.activities ?? []),
      ...(entry.medications ?? []).map((medication) => medication.name)
    ])
    .join('\n');
}
