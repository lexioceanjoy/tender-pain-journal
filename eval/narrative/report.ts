import type { AiSummaryRequest } from '../../src/features/ai-summary/aiSummary';
import type { CheckReport } from './checks';

// Output side of the harness: run records, summary.md, and the blinded
// review sheets. No network and no secrets here; scripts/eval-narrative.ts
// does the calling.

export type RunConfig = {
  provider: string;
  model: string;
  instructionsSha256: string;
  gitCommit: string;
  gitDirty: boolean;
};

export type SampleResult = {
  sample: number;
  narrative?: string;
  /** provider.safeError() output only; never a raw SDK error. */
  error?: string;
  report: CheckReport;
};

export type FixtureResult = {
  id: string;
  purpose: string;
  request: AiSummaryRequest;
  samples: SampleResult[];
  /** Chosen at random by the harness, not by the reviewer. */
  scoredSample: number;
};

export type RunRecord = {
  label: string;
  startedAt: string;
  config: RunConfig;
  samplesPerFixture: number;
  fixtures: FixtureResult[];
};

export const RUBRIC = [
  { id: 'faithfulness', label: 'Faithfulness', help: 'Every statement is supported by the records; nothing invented or overstated.' },
  { id: 'usefulness', label: 'Usefulness (clinician lens)', help: 'Read in about a minute, would this change what a clinician asks about? Change over time with numbers; location, spread, side, quality, timing, logged worse/easing factors; daily-life impact where recorded; pain around logged treatments, described, never judged.' },
  { id: 'coverage', label: 'Coverage', help: 'Every must-mention fact appears, plus anything else a clinician would want from these records.' },
  { id: 'cooccurrence', label: 'Co-occurrence framing', help: 'Relationships are "recorded alongside", never cause, prediction, or explanation.' },
  { id: 'limits', label: 'Limits stated', help: 'Small samples, gaps, and missing fields acknowledged where relevant, without filler.' },
  { id: 'readability', label: 'Clinician readability', help: 'Could be read aloud at the start of an appointment: plain, ordered, no hedging padding.' }
] as const;

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildSummaryMarkdown(run: RunRecord) {
  const total = run.fixtures.reduce((count, fixture) => count + fixture.samples.length, 0);
  const passed = run.fixtures.reduce((count, fixture) => count + fixture.samples.filter((sample) => sample.report.passed).length, 0);
  const lines = [
    `# Narrative evaluation: ${run.label}`,
    '',
    `- Started: ${run.startedAt}`,
    `- Provider / model: ${run.config.provider} / ${run.config.model}`,
    `- Instructions SHA-256: \`${run.config.instructionsSha256}\``,
    `- Git commit: \`${run.config.gitCommit}\`${run.config.gitDirty ? ' (uncommitted changes present)' : ''}`,
    `- Hard checks: **${passed} of ${total}** narratives passed`,
    '',
    '| Fixture | Samples passed | Failures | Reviewer flags | Scored sample |',
    '| --- | --- | --- | --- | --- |',
    ...run.fixtures.map((fixture) => {
      const ok = fixture.samples.filter((sample) => sample.report.passed).length;
      const failures = fixture.samples.flatMap((sample) => sample.report.failures.map((finding) => `#${sample.sample} ${finding.check}`));
      const flags = fixture.samples.reduce((count, sample) => count + sample.report.flags.length, 0);
      return `| ${fixture.id} | ${ok}/${fixture.samples.length} | ${failures.length ? failures.join(', ') : '—'} | ${flags} | #${fixture.scoredSample} |`;
    }),
    '',
    'Hard-check failures are listed in run.json with the sentence each one is about.',
    'Rubric scores come from review.html and are not part of this file until the review is done.',
    ''
  ];
  return lines.join('\n');
}

function recordsTable(request: AiSummaryRequest) {
  const rows = [...request.entries]
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    .map((entry) => {
      const context = [
        entry.activities?.length ? `Activities: ${entry.activities.join(', ')}` : '',
        entry.sleep ? `Sleep: ${entry.sleep}` : '',
        entry.stress ? `Stress: ${entry.stress}` : '',
        entry.mood ? `Mood: ${entry.mood}` : '',
        entry.cycle ? `Cycle: ${entry.cycle}` : '',
        entry.medications?.length
          ? `Medication: ${entry.medications.map((medication) => [medication.name, medication.dose, medication.perceivedEffect].filter(Boolean).join(' ')).join('; ')}`
          : '',
        entry.note ? `Note: “${entry.note}”` : ''
      ].filter(Boolean).join(' · ');
      return `<tr><td>${escapeHtml(entry.occurredAt.slice(0, 16).replace('T', ' '))}</td><td>${entry.intensity}/10</td>`
        + `<td>${escapeHtml([...entry.locations, ...(entry.refinedLocations ?? [])].join(', '))}</td>`
        + `<td>${escapeHtml((entry.sensations ?? []).join(', '))}</td><td>${escapeHtml(context)}</td></tr>`;
    });
  return `<details><summary>Records sent (${request.entries.length}, ${escapeHtml(request.from)} to ${escapeHtml(request.to)})</summary>`
    + '<table><thead><tr><th>When</th><th>Intensity</th><th>Locations</th><th>Sensations</th><th>Context</th></tr></thead>'
    + `<tbody>${rows.join('')}</tbody></table></details>`;
}

function findingsList(report: CheckReport) {
  const items = [
    ...report.failures.map((finding) => `<li class="fail">Hard fail · ${escapeHtml(finding.check)}: ${escapeHtml(finding.detail)}</li>`),
    ...report.flags.map((finding) => `<li class="flag">Decide · ${escapeHtml(finding.detail)}<br><q>${escapeHtml(finding.excerpt)}</q></li>`),
    ...report.coverage.map((item) => `<li class="${item.found ? 'ok' : 'flag'}">Must mention “${escapeHtml(item.fact)}”: ${item.found ? 'found' : 'not found by phrase match; check by reading'}</li>`)
  ];
  return items.length ? `<ul class="findings">${items.join('')}</ul>` : '';
}

function rubricInputs(name: string) {
  return RUBRIC.map((dimension) => `<fieldset><legend title="${escapeHtml(dimension.help)}">${escapeHtml(dimension.label)}</legend>`
    + [1, 2, 3, 4, 5].map((score) => `<label><input type="radio" name="${name}.${dimension.id}" value="${score}">${score}</label>`).join('')
    + `<p class="help">${escapeHtml(dimension.help)}</p></fieldset>`).join('');
}

function narrativeBlock(sample: SampleResult) {
  return sample.narrative
    ? `<blockquote>${escapeHtml(sample.narrative).replace(/\n/g, '<br>')}</blockquote><p class="meta">${sample.report.wordCount} words</p>`
    : `<p class="fail">No narrative: ${escapeHtml(sample.error ?? 'missing')}</p>`;
}

function page(title: string, body: string, downloadName: string) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root { color-scheme: light dark; --bg: #fff9f4; --fg: #2b1d26; --muted: #6b5a64; --line: #e4d6dc; --fail: #a3122c; --flag: #8a5a00; --ok: #2f6b3a; }
@media (prefers-color-scheme: dark) { :root { --bg: #1d1519; --fg: #f3e9ee; --muted: #b9a7b1; --line: #3d2f36; --fail: #ff8a9b; --flag: #f0c063; --ok: #8fd19e; } }
body { background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, sans-serif; max-width: 52rem; margin: 0 auto; padding: 1rem; }
section { border-top: 1px solid var(--line); padding: 1rem 0; }
blockquote { margin: .5rem 0; padding: .75rem 1rem; border-left: 4px solid var(--line); }
table { border-collapse: collapse; font-size: .85rem; width: 100%; } td, th { border-bottom: 1px solid var(--line); padding: .25rem .4rem; text-align: left; vertical-align: top; }
fieldset { border: 0; padding: 0; margin: .4rem 0; } legend { font-weight: 600; } label { margin-right: .8rem; display: inline-flex; gap: .2rem; min-height: 44px; align-items: center; }
.help, .meta { color: var(--muted); font-size: .85rem; margin: .1rem 0; } .fail { color: var(--fail); } .flag { color: var(--flag); } .ok { color: var(--ok); }
.findings { font-size: .9rem; } .pair { display: grid; gap: 1rem; } @media (min-width: 760px) { .pair { grid-template-columns: 1fr 1fr; } }
button { font: inherit; padding: .6rem 1rem; min-height: 44px; }
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<p class="meta">Synthetic fixtures only. Scores stay in this page until you download them.</p>
<form id="scores">${body}</form>
<button type="button" id="download">Download scores (JSON)</button>
<script>
document.getElementById('download').addEventListener('click', function () {
  var data = {};
  new FormData(document.getElementById('scores')).forEach(function (value, key) { data[key] = value; });
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = ${JSON.stringify(downloadName)};
  link.click();
  URL.revokeObjectURL(link.href);
});
</script>
</body></html>
`;
}

/** Initial review: one randomly chosen sample per fixture, scored on the rubric. */
export function buildReviewHtml(run: RunRecord) {
  const sections = run.fixtures.map((fixture) => {
    const sample = fixture.samples.find((item) => item.sample === fixture.scoredSample)!;
    return `<section><h2>${escapeHtml(fixture.id)}</h2><p class="meta">${escapeHtml(fixture.purpose)}</p>`
      + recordsTable(fixture.request) + narrativeBlock(sample) + findingsList(sample.report)
      + rubricInputs(fixture.id)
      + `<label>Notes <textarea name="${escapeHtml(fixture.id)}.notes" rows="2" cols="50"></textarea></label></section>`;
  });
  return page('Narrative review', sections.join(''), 'scores.json');
}

export type BlindPair = { fixtureId: string; a: 'before' | 'after'; b: 'before' | 'after' };

/**
 * Before/after review. Left/right order is random per fixture and the page
 * never names the configurations; the key goes in a separate file.
 */
export function buildCompareHtml(before: RunRecord, after: RunRecord, flip: (fixtureId: string) => boolean) {
  const key: BlindPair[] = [];
  const sections = before.fixtures.map((beforeFixture) => {
    const afterFixture = after.fixtures.find((fixture) => fixture.id === beforeFixture.id);
    if (!afterFixture) throw new Error(`Fixture ${beforeFixture.id} is missing from the "after" run.`);
    const pick = (fixture: FixtureResult) => fixture.samples.find((sample) => sample.sample === fixture.scoredSample)!;
    const swap = flip(beforeFixture.id);
    const [a, b] = swap ? [pick(afterFixture), pick(beforeFixture)] : [pick(beforeFixture), pick(afterFixture)];
    key.push({ fixtureId: beforeFixture.id, a: swap ? 'after' : 'before', b: swap ? 'before' : 'after' });
    const id = escapeHtml(beforeFixture.id);
    return `<section><h2>${id}</h2><p class="meta">${escapeHtml(beforeFixture.purpose)}</p>`
      + recordsTable(beforeFixture.request)
      + '<div class="pair">'
      + `<div><h3>Narrative A</h3>${narrativeBlock(a)}${findingsList(a.report)}${rubricInputs(`${beforeFixture.id}.A`)}</div>`
      + `<div><h3>Narrative B</h3>${narrativeBlock(b)}${findingsList(b.report)}${rubricInputs(`${beforeFixture.id}.B`)}</div>`
      + '</div>'
      + `<fieldset><legend>Which would you rather hand to a clinician?</legend>`
      + ['A', 'B', 'no preference'].map((choice) => `<label><input type="radio" name="${id}.preference" value="${choice}">${choice}</label>`).join('')
      + '</fieldset></section>';
  });
  return { html: page('Before/after review (blinded)', sections.join(''), 'compare-scores.json'), key };
}
