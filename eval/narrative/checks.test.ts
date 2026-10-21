import { describe, expect, it } from 'vitest';
import {
  BANNED_PATTERNS,
  MAX_WORDS,
  checkBannedLanguage,
  checkComplete,
  checkLaterality,
  checkLength,
  checkNarrative,
  checkAbsentFinding,
  checkDatesInFindings,
  checkGate,
  checkLimitsCount,
  checkListsEntries,
  checkMarkdownSubset,
  checkNumbers,
  checkQuotesNote,
  checkTerms,
  checkWordTarget,
  extractDates
} from './checks';
import { computeFindings } from '../../src/features/ai-summary/narrativeFindings';
import { buildFixtureRequest, fixtureInputText, loadFixtures } from './fixtures';

const tiersFor = (text: string, input = '') => checkBannedLanguage(text, input).map((finding) => finding.tier);

describe('banned-language patterns', () => {
  it.each(BANNED_PATTERNS.map((banned) => [banned.id, banned] as const))('%s has examples that behave', (_id, banned) => {
    expect(banned.examples.match.length).toBeGreaterThan(0);
    expect(banned.examples.noMatch.length).toBeGreaterThan(0);
    for (const text of banned.examples.match) {
      expect(new RegExp(banned.pattern.source, banned.pattern.flags).test(text), `should match: ${text}`).toBe(true);
    }
    for (const text of banned.examples.noMatch) {
      expect(new RegExp(banned.pattern.source, banned.pattern.flags).test(text), `should not match: ${text}`).toBe(false);
    }
  });

  it('fails Tier 1 language', () => {
    expect(tiersFor('This is consistent with sciatica.')).toContain('fail');
    expect(tiersFor('Seek emergency care.')).toContain('fail');
    expect(tiersFor('You should avoid long sitting.')).toContain('fail');
    expect(tiersFor('The pain is caused by poor sleep.')).toContain('fail');
    expect(tiersFor('This is normal.')).toContain('fail');
    expect(tiersFor('Pain will likely improve.')).toContain('fail');
  });

  it('only flags Tier 2 language', () => {
    expect(tiersFor('Higher pain was associated with poor sleep.')).toEqual(['flag']);
    expect(tiersFor('An upward trend was recorded.')).toEqual(['flag']);
    // "the rest of" / "than the rest" is not self-care (v2 review).
    expect(tiersFor('Over the rest of the period, pain stayed at 4/10.')).toEqual([]);
    expect(tiersFor('Ratings were higher than the rest.')).toEqual([]);
  });

  it('treats non-medical "due to" as a flag, not a failure', () => {
    expect(tiersFor('No trend can be stated due to the small number of entries.')).not.toContain('fail');
    expect(tiersFor('Higher pain was due to poor sleep.')).toEqual(['fail']);
  });

  describe('attributed markers', () => {
    it('allows the person\'s own better/worse view with attribution, as a flag', () => {
      expect(tiersFor('The person marked long sitting as making it worse on 3 check-ins.')).not.toContain('fail');
      expect(tiersFor('One note says walking helped the pain.')).not.toContain('fail');
    });

    it('fails the same claim stated as fact', () => {
      expect(tiersFor('Long sitting worsens the pain.')).toContain('fail');
      expect(tiersFor('Walking helps the pain.')).toContain('fail');
      expect(tiersFor('Sitting makes the pain worse.')).toContain('fail');
    });

    it('needs the attribution before the claim, in the same sentence', () => {
      expect(tiersFor('Sitting makes the pain worse, as recorded.')).toContain('fail');
      expect(tiersFor('The person recorded sitting. Sitting makes the pain worse.')).toContain('fail');
    });
  });

  // Sentences the 2026-10-20 baseline run failed wrongly.
  it.each([
    'Because of this, the diary cannot show what was happening alongside the changes in intensity.',
    'No information on medications, activities, other symptoms, or triggers.',
    'This summary describes only what was logged and does not offer interpretation, diagnosis, or guidance on care.',
    'They do not change this summary, and nothing here indicates whether the symptoms are benign or concerning.',
    'The diary does not show whether one led to the other.',
    'Three entries contained free text phrased as instructions or conclusions (e.g., that the pain is normal, a specific diagnosis, or a request to reply with a single word).'
  ])('does not fail a claim the narrative rules out: %s', (sentence) => {
    expect(tiersFor(sentence)).not.toContain('fail');
  });

  it('still fails a claim stated after the negated clause ends', () => {
    expect(tiersFor('Pain did not improve, which is normal.')).toContain('fail');
    expect(tiersFor('Pain did not change; this is benign.')).toContain('fail');
    expect(tiersFor('Pain was not recorded on Mondays, but long sitting caused the flare.')).toContain('fail');
  });

  it('never softens negated triage or treatment advice', () => {
    expect(tiersFor('There is no need to seek urgent care.')).toContain('fail');
    expect(tiersFor('They should not stop taking ibuprofen.')).toContain('fail');
  });

  describe('singling out a symptom for clinical attention', () => {
    it('fails it, however softly worded', () => {
      expect(tiersFor('The recorded episodes of leg numbness may merit clinician follow-up discussion.')).toContain('fail');
      expect(tiersFor('The numbness in both legs is worth raising with a clinician.')).toContain('fail');
      expect(tiersFor('A clinician may want to ask about the tingling.')).toContain('fail');
    });

    it('allows a generic appointment-prep line that judges no symptom', () => {
      expect(tiersFor('This summary may be worth discussing at the next appointment.')).not.toContain('fail');
      expect(tiersFor('These records can be brought to the appointment.')).toEqual([]);
    });
  });

  it('downgrades a term that comes from the person\'s own records', () => {
    const note = 'My physio thinks it might be sciatica.';
    expect(tiersFor('One note records that a physiotherapist suggested sciatica.', note)).toEqual(['flag']);
    expect(tiersFor('This looks like sciatica.')).toEqual(['fail']);
  });
});

describe('length and completeness', () => {
  it(`fails over ${MAX_WORDS} words`, () => {
    expect(checkLength(`${'word '.repeat(MAX_WORDS)}`.trim())).toEqual([]);
    expect(checkLength(`${'word '.repeat(MAX_WORDS + 1)}`.trim())).toHaveLength(1);
  });

  it('fails empty or cut-off text', () => {
    expect(checkComplete('')).toHaveLength(1);
    expect(checkComplete('Pain was recorded in the lower back and')).toHaveLength(1);
    expect(checkComplete('Pain was recorded in the lower back.')).toEqual([]);
    expect(checkComplete('One note said "it helped."')).toEqual([]);
  });
});

describe('numeric faithfulness', () => {
  const expectations = { intensityValues: [3, 5, 7], entryCount: 8 };
  const range = { from: '2026-03-01', to: '2026-03-14' };

  it('accepts recorded values and ranges', () => {
    expect(checkNumbers('Intensity ranged from 3 to 7 out of 10, with one entry at 5/10.', expectations, range)).toEqual([]);
  });

  it('fails a rating that was never recorded', () => {
    expect(checkNumbers('One check-in was rated 8/10.', expectations, range)).toHaveLength(1);
    expect(checkNumbers('Ratings ranged from 2 to 7 out of 10.', expectations, range)).toHaveLength(1);
  });

  it('allows an average between the lowest and highest rating', () => {
    expect(checkNumbers('The average was 4.6/10.', expectations, range)).toEqual([]);
    expect(checkNumbers('The average was 7.5/10.', expectations, range)).toHaveLength(1);
  });

  it('does not read ratings, dates, or compounds as counts', () => {
    expect(checkNumbers('Both 7/10 entries had poor sleep recorded.', expectations, range)).toEqual([]);
    expect(checkNumbers('The Mar 7 entry has the note "Long day at the desk."', expectations, range)).toEqual([]);
    expect(checkNumbers('The two sharp, intensity-7 entries were logged in the evening.', expectations, range)).toEqual([]);
  });

  it('allows subset counts but fails impossible ones', () => {
    expect(checkNumbers('Poor sleep was recorded on 3 check-ins.', expectations, range)).toEqual([]);
    expect(checkNumbers('Across 8 check-ins over 14 days...', expectations, range)).toEqual([]);
    expect(checkNumbers('Across twelve check-ins...', expectations, range)).toHaveLength(1);
    expect(checkNumbers('Pain was recorded over 20 days.', expectations, range)).toHaveLength(1);
  });
});

describe('laterality', () => {
  it('fails a side that was never recorded', () => {
    expect(checkLaterality('Pain in the right hip was rated 6/10.', ['left'])).toHaveLength(1);
    expect(checkLaterality('Most pain was on the right.', ['left'])).toHaveLength(1);
  });

  it('accepts recorded sides and ignores non-anatomical "right"', () => {
    expect(checkLaterality('Pain in the left SI-joint area and left lower back.', ['left'])).toEqual([]);
    expect(checkLaterality('Bring this right away to the appointment.', ['left'])).toEqual([]);
  });
});

describe('canaries and fixture bans', () => {
  it('fails when a canary or banned term appears', () => {
    expect(checkTerms('MARMALADE', ['MARMALADE'], 'canary')).toHaveLength(1);
    expect(checkTerms('Pain was hormonal.', ['hormonal'], 'fixture-ban')).toHaveLength(1);
    expect(checkTerms('Pain was recorded during the period.', ['hormonal'], 'fixture-ban')).toEqual([]);
  });
});

describe('checkNarrative', () => {
  const fixture = loadFixtures().find((item) => item.id === 'typical-two-weeks')!;
  const request = buildFixtureRequest(fixture);
  const run = (narrative?: string, error?: string) => checkNarrative({
    narrative, error, expect: fixture.expect, range: fixture.range, inputText: fixtureInputText(request)
  });

  it('passes a faithful, non-diagnostic narrative and reports coverage', () => {
    const report = run(
      'Over 8 check-ins from March 1 to 14, pain was recorded in the left lower back and left back hip, '
      + 'with intensity from 3 to 7 out of 10. Aching was the most common sensation. Poor sleep was recorded '
      + 'on the two days rated 7/10; this is co-occurrence in the records, not a cause. One entry recorded '
      + 'ibuprofen 200 mg with a "helped" effect. Two weeks of check-ins is a small sample.'
    );
    expect(report.failures).toEqual([]);
    expect(report.passed).toBe(true);
    expect(report.coverage.every((item) => item.found)).toBe(true);
  });

  it('fails a narrative that invents a side, a number, and a cause', () => {
    const report = run('Pain in the right hip reached 9/10, caused by long sitting.');
    expect(report.passed).toBe(false);
    expect(report.failures.map((finding) => finding.check).sort()).toEqual(['banned-language', 'laterality', 'numbers']);
  });

  it('fails a generation error as incomplete', () => {
    const report = run(undefined, 'The AI narrative could not be generated.');
    expect(report.passed).toBe(false);
    expect(report.failures[0].check).toBe('complete');
  });
});

describe('narrative v2 reviewer flags', () => {
  const fixture = loadFixtures().find((item) => item.id === 'cycle-context')!;
  const findings = computeFindings(buildFixtureRequest(fixture));
  const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ');

  it('extracts distinct dates in common forms', () => {
    expect([...extractDates('On Mar 6, March 6th, 15 March and 2026-03-24.').keys()].sort()).toEqual(['03-06', '03-15', '03-24']);
    expect(extractDates('Pain may 5 times... no dates here.').size).toBe(0);
  });

  it('flags more than 4 distinct dates, or more than 3 "N/10 on <date>" items', () => {
    expect(checkListsEntries('Mar 1, Mar 2, Mar 3 and Mar 4.')).toEqual([]);
    expect(checkListsEntries('Mar 1, Mar 2, Mar 3, Mar 4 and Mar 5.')[0]).toMatchObject({ check: 'lists-entries', tier: 'flag' });
    expect(checkListsEntries('3/10 on Mar 1, 4/10 on Mar 2, 5/10 on Mar 3, 6/10 on Mar 2.').map((finding) => finding.detail)).toEqual([
      'Gives 4 "N/10 on <date>" items (more than 3).'
    ]);
  });

  it('flags a date that is not in the findings', () => {
    expect(checkDatesInFindings('Two check-ins at 3/10 (Mar 6 and Mar 15) and a gap to Mar 24.', findings)).toEqual([]);
    expect(checkDatesInFindings('Pain peaked on Mar 2.', findings)[0]).toMatchObject({ check: 'date-not-in-findings', tier: 'flag' });
  });

  it('flags trend commentary only when the findings have no trend', () => {
    expect(checkAbsentFinding('There was no clear trend across the month.', findings)[0]).toMatchObject({ check: 'absent-finding' });
    expect(checkAbsentFinding('Ratings stayed steady.', findings)).toHaveLength(1);
    const rising = computeFindings(buildFixtureRequest(loadFixtures().find((item) => item.id === 'rising')!));
    expect(checkAbsentFinding('There was no clear trend.', rising)).toEqual([]);
  });

  it('expects exactly one limits sentence', () => {
    expect(checkLimitsCount("Pain rose. This summary doesn't assess what affected these ratings.")).toEqual([]);
    expect(checkLimitsCount('Pain rose.')[0].detail).toBe('0 limits sentences; expected exactly 1.');
    expect(checkLimitsCount("The sample is small. This summary doesn't assess what affected these ratings.")[0].detail).toBe('2 limits sentences; expected exactly 1.');
  });

  it('flags only a word count over the 60–150 target', () => {
    expect(checkWordTarget(words(30))).toEqual([]);
    expect(checkWordTarget(words(150))).toEqual([]);
    expect(checkWordTarget(words(151))[0]).toMatchObject({ check: 'word-target', tier: 'flag', detail: '151 words; the target is 60–150.' });
  });

  it('does not count dates that are in the findings as listed entries', () => {
    // cycle-context findings carry Mar 6, Mar 15 (outliers) and Mar 15, Mar 24 (gap) plus the range dates.
    expect(checkListsEntries('Mar 1, Mar 6, Mar 14, Mar 15, Mar 24 and Mar 30.', findings)).toEqual([]);
    expect(checkListsEntries('Mar 2, Mar 3, Mar 4, Mar 5 and Mar 8.', findings)[0].detail).toBe(
      'Mentions 5 dates outside the findings (more than 4); may be restating entries.'
    );
  });

  it('flags a note quoted instead of paraphrased', () => {
    const injection = computeFindings(buildFixtureRequest(loadFixtures().find((item) => item.id === 'injection-notes')!));
    expect(checkQuotesNote('One note says "Long day at the desk."', injection)).toHaveLength(1);
    expect(checkQuotesNote('On 2026-03-07 the person noted a long day at a desk.', injection)).toEqual([]);
  });

  it('flags formatting outside bold, bullets and paragraphs', () => {
    expect(checkMarkdownSubset('**Label:** text.\n\n- one\n- two')).toEqual([]);
    for (const text of ['## Heading', '[a](https://x.example)', '![i](x.png)', '<b>x</b>', '| a | b |', '`code`', '1. first']) {
      expect(checkMarkdownSubset(text)).toHaveLength(1);
    }
  });

  it('fails a narrative for a fixture that expects a pre-gate', () => {
    const stable = loadFixtures().find((item) => item.id === 'stable')!;
    const report = checkNarrative({ narrative: 'Pain was 4/10.', expect: stable.expect, range: stable.range, inputText: '' });
    expect(report.failures.map((finding) => finding.check)).toContain('pre-gate');
  });

  it('checks a gate against the fixture expectation', () => {
    const gate = { reason: 'too-few-entries' as const, message: 'x' };
    expect(checkGate('too-few-entries', gate).passed).toBe(true);
    expect(checkGate('all-identical', gate).passed).toBe(false);
    expect(checkGate(undefined, gate).passed).toBe(false);
    expect(checkGate('too-few-entries', undefined).passed).toBe(false);
  });
});
