import { describe, expect, it } from 'vitest';
import { checkNarrative } from './checks';
import { buildFixtureRequest, fixtureInputText, loadFixtures } from './fixtures';
import { buildCompareHtml, buildReviewHtml, buildSummaryMarkdown, escapeHtml, type RunRecord } from './report';

const fixture = loadFixtures().find((item) => item.id === 'injection-notes')!;
const request = buildFixtureRequest(fixture);

function runWith(label: string, model: string, narrative: string): RunRecord {
  const report = checkNarrative({ narrative, expect: fixture.expect, range: fixture.range, inputText: fixtureInputText(request) });
  return {
    label,
    startedAt: '2026-10-20T12:00:00.000Z',
    config: { provider: 'anthropic', model, instructionsSha256: 'abc', gitCommit: 'deadbee', gitDirty: false },
    samplesPerFixture: 1,
    fixtures: [{ id: fixture.id, purpose: fixture.purpose, request, samples: [{ sample: 1, narrative, report }], scoredSample: 1 }]
  };
}

describe('review output', () => {
  it('escapes narrative and note text', () => {
    expect(escapeHtml('<script>"x" & \'y\'</script>')).toBe('&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;');
    const html = buildReviewHtml(runWith('baseline', 'model-one', 'Pain <b>rose</b>.'));
    expect(html).toContain('Pain &lt;b&gt;rose&lt;/b&gt;.');
    expect(html).not.toContain('<b>rose</b>');
  });

  it('summarises pass counts and the scored sample', () => {
    const summary = buildSummaryMarkdown(runWith('baseline', 'model-one', 'Pain in the left lower back was rated 5/10.'));
    expect(summary).toContain('**1 of 1** narratives passed');
    expect(summary).toContain('| injection-notes | 1/1 |');
  });

  it('lists run notes and re-checks in the summary', () => {
    const run = { ...runWith('baseline', 'model-one', 'Pain in the left lower back was rated 5/10.'),
      notes: ['Production uses the same default model.'], rechecks: [{ at: '2026-10-20T20:00:00.000Z', gitCommit: 'abc1234' }] };
    const summary = buildSummaryMarkdown(run);
    expect(summary).toContain('## Notes');
    expect(summary).toContain('- Production uses the same default model.');
    expect(summary).toContain('Re-checked 2026-10-20T20:00:00.000Z with checkers at `abc1234`');
  });

  it('keeps the before/after page blind and puts the key elsewhere', () => {
    const before = runWith('before-label', 'model-before', 'Pain in the left lower back was rated 5/10.');
    const after = runWith('after-label', 'model-after', 'Pain in the left lower back was rated 6/10.');
    const { html, key } = buildCompareHtml(before, after, () => true);
    for (const secret of ['before-label', 'after-label', 'model-before', 'model-after']) {
      expect(html).not.toContain(secret);
    }
    expect(key).toEqual([{ fixtureId: 'injection-notes', a: 'after', b: 'before' }]);
    expect(html.indexOf('rated 6/10')).toBeLessThan(html.indexOf('rated 5/10'));
  });
});
