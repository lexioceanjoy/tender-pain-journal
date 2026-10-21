import { describe, expect, it } from 'vitest';
import { aiSummaryRequestSchema } from '../../src/features/ai-summary/aiSummarySchema';
import { narrativeGate } from '../../src/features/ai-summary/narrativeFindings';
import { buildFixtureRequest, fixtureInputText, loadFixtures } from './fixtures';

const fixtures = loadFixtures();

describe('narrative evaluation fixtures', () => {
  it('has exactly the sixteen fixtures the plans define', () => {
    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      'area-details', 'co-occurrence-trap', 'cycle-context', 'dense-month', 'identical-with-note', 'injection-notes',
      'long-gap', 'medications', 'precision-areas', 'rising', 'single-entry', 'stable',
      'three-entries', 'two-entries', 'typical-two-weeks', 'worrying-notes'
    ]);
  });

  it('expects the pre-gate on exactly single-entry, stable and two-entries', () => {
    const gated = Object.fromEntries(fixtures.filter((fixture) => fixture.expect.preGate).map((fixture) => [fixture.id, fixture.expect.preGate]));
    expect(gated).toEqual({ 'single-entry': 'too-few-entries', stable: 'all-identical', 'two-entries': 'too-few-entries' });
  });

  describe.each(fixtures.map((fixture) => [fixture.id, fixture] as const))('%s', (_id, fixture) => {
    const request = buildFixtureRequest(fixture);

    it('builds a valid request through the app payload builder', () => {
      expect(aiSummaryRequestSchema.safeParse(request).success).toBe(true);
    });

    it('hits its expected pre-gate, or none', () => {
      expect(narrativeGate(request)?.reason).toBe(fixture.expect.preGate);
    });

    it('uses fixed timestamps inside its date range', () => {
      for (const entry of fixture.entries) {
        const occurredAt = String(entry.occurredAt);
        expect(occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(Z|[+-]\d{2}:\d{2})$/);
        const day = occurredAt.slice(0, 10);
        expect(day >= fixture.range.from && day <= fixture.range.to).toBe(true);
      }
    });

    // expect is hand-written; these keep it from drifting from the entries.
    it('states the real entry count and intensity values', () => {
      expect(fixture.expect.entryCount).toBe(request.entries.length);
      expect(fixture.expect.intensityValues).toEqual([...new Set(request.entries.map((entry) => entry.intensity))].sort((a, b) => a - b));
    });

    it('lists exactly the sides that appear in the location labels sent', () => {
      const labels = request.entries.flatMap((entry) => [...entry.locations, ...(entry.refinedLocations ?? [])]).join(' ').toLowerCase();
      const sides = (['left', 'right'] as const).filter((side) => new RegExp(`\\b${side}\\b`).test(labels));
      expect([...fixture.expect.sides].sort()).toEqual(sides);
    });

    it('puts every canary into the input, so the check is meaningful', () => {
      for (const canary of fixture.expect.canaries ?? []) {
        expect(fixtureInputText(request)).toContain(canary);
      }
    });
  });

  it('area-details sends only overall values, never the per-area detail', () => {
    const fixture = fixtures.find((item) => item.id === 'area-details')!;
    const sent = JSON.stringify(buildFixtureRequest(fixture));
    expect(sent).not.toContain('burning');
    expect(fixture.expect.intensityValues).not.toContain(8);
    expect(fixture.expect.mustNotMention).toContain('burning');
  });
});
