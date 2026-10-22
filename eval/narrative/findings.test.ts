import { describe, expect, it } from 'vitest';
import { computeFindings, narrativeGate, type NarrativeFindings } from '../../src/features/ai-summary/narrativeFindings';
import { buildFixtureRequest, loadFixtures } from './fixtures';

// Pins what each fixture's findings are under the current thresholds
// (docs/plans/narrative-v2.md, "What each fixture yields"), so a threshold
// change shows up here as a visible diff rather than silently changing
// what the model is asked to say.
function summarize(findings: NarrativeFindings) {
  const lines: string[] = [];
  if (findings.trend) lines.push(`trend ${findings.trend.direction} ${findings.trend.firstHalf.mean} -> ${findings.trend.secondHalf.mean}`);
  for (const association of findings.associations) {
    lines.push(`association ${association.factor.kind}:${association.factor.label} ${association.with.entries} at ${association.with.mean} vs ${association.without.mean}`);
  }
  for (const outlier of findings.outliers) lines.push(`outlier ${outlier.date} ${outlier.intensity}`);
  for (const kind of ['locations', 'sensations'] as const) {
    if (findings[kind].recurring.length) lines.push(`recurring ${kind} ${findings[kind].recurring.map((label) => `${label.label} ${label.entries}`).join(', ')}`);
    for (const label of findings[kind].firstRecordedInRange) lines.push(`first recorded ${label.label} ${label.date}`);
  }
  for (const gap of findings.gaps) lines.push(`gap ${gap.lastCheckInBefore} to ${gap.nextCheckInAfter} (${gap.daysWithoutCheckIns} days)`);
  for (const treatment of findings.treatments) lines.push(`treatment ${treatment.name} ${treatment.entries} ${JSON.stringify(treatment.perceivedEffects)}`);
  if (findings.notes.length) lines.push(`notes ${findings.notes.length}`);
  return lines;
}

const yields: Record<string, string[] | string> = {
  'area-details': ['recurring locations Left lower back 5, Left SI-joint area 5, Right back hip 5', 'recurring sensations tight 5'],
  'co-occurrence-trap': ['association sleep:poor 4 at 7.5 vs 3.5', 'recurring locations Left lower back 8, Right lower back 8', 'recurring sensations aching 8'],
  'cycle-context': [
    'association cycle:period 3 at 7.7 vs 4.6', 'outlier 2026-03-06 3', 'outlier 2026-03-15 3',
    'recurring locations Left groin and pubic area 8, Left lower back 8', 'recurring sensations aching 8', 'gap 2026-03-15 to 2026-03-24 (8 days)'
  ],
  'dense-month': ['recurring locations Left lower back 30'],
  'identical-with-note': ['recurring locations Left lower back 6', 'recurring sensations aching 6', 'notes 1'],
  'injection-notes': ['recurring locations Left lower back 5', 'recurring sensations aching 4', 'notes 4'],
  'long-gap': ['recurring locations Left buttock 7', 'recurring sensations aching 5', 'first recorded sharp 2026-04-06', 'gap 2026-03-09 to 2026-03-31 (21 days)'],
  medications: [
    'recurring locations Left buttock 6', 'recurring sensations aching 4',
    'treatment Ibuprofen 3 {"helped":2,"not sure yet":1}', 'treatment Naproxen 2 {"no change":2}'
  ],
  'precision-areas': [
    'recurring locations Left SI-joint area 3', 'first recorded Right lower back 2026-03-07', 'first recorded Tailbone area 2026-03-07',
    'recurring sensations aching 3, tight 3', 'first recorded sharp 2026-03-07'
  ],
  rising: ['trend up 3 -> 6.3', 'association sensation:sharp 4 at 7 vs 3.5', 'recurring locations Left back hip 12', 'recurring sensations aching 12', 'first recorded sharp 2026-03-17'],
  'single-entry': 'too-few-entries',
  stable: 'all-identical',
  'three-entries': ['recurring locations Left lower back 3'],
  'two-entries': 'too-few-entries',
  'typical-two-weeks': [
    'association location:Left back hip 4 at 6.5 vs 4.3', 'recurring locations Left lower back 7, Left back hip 4', 'recurring sensations aching 6',
    'treatment Ibuprofen 1 {"helped":1}'
  ],
  'worrying-notes': ['recurring locations Left lower back 4', 'recurring sensations aching 3', 'first recorded tingling 2026-03-12', 'notes 2']
};

describe('what each fixture yields', () => {
  it.each(loadFixtures().map((fixture) => [fixture.id, fixture] as const))('%s', (id, fixture) => {
    const request = buildFixtureRequest(fixture);
    const gate = narrativeGate(request);
    expect(gate ? gate.reason : summarize(computeFindings(request))).toEqual(yields[id]);
  });
});
