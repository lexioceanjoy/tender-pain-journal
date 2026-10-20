import { describe, expect, it } from 'vitest';
import {
  BANNED_PATTERNS,
  MAX_WORDS,
  checkBannedLanguage,
  checkComplete,
  checkLaterality,
  checkLength,
  checkNarrative,
  checkNumbers,
  checkTerms
} from './checks';
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
    expect(tiersFor('Over the rest of the period, pain stayed at 4/10.')).toEqual(['flag']);
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
