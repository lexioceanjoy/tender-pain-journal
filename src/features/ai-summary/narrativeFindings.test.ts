import { describe, expect, it } from 'vitest';
import type { AiSummaryRequest } from './aiSummarySchema';
import {
  ASSOCIATION_MIN_MEAN_DIFF, computeFindings, countWords, DATA_GAP_MIN_DAYS, limitsSentence, MAX_NOTES,
  MIN_ENTRIES_FOR_NARRATIVE, narrativeGate, OUTLIER_MIN_DEVIATION, SIDE_MIN_ENTRIES, TREND_MIN_DELTA, TREND_MIN_ENTRIES
} from './narrativeFindings';

type Entry = AiSummaryRequest['entries'][number];

function day(n: number) {
  const date = new Date(Date.UTC(2026, 2, 1 + n));
  return date.toISOString().slice(0, 10);
}

function entry(n: number, intensity: number, extra: Partial<Entry> = {}): Entry {
  return { occurredAt: `${day(n)}T09:00:00.000Z`, intensity, locations: ['Left lower back'], ...extra };
}

function request(entries: Entry[], from = day(0), to = day(29)): AiSummaryRequest {
  return { from, to, entries };
}

describe('narrativeGate', () => {
  it(`needs at least ${MIN_ENTRIES_FOR_NARRATIVE} in-range entries`, () => {
    const two = request([entry(0, 3), entry(1, 5)]);
    expect(narrativeGate(two)).toEqual({ reason: 'too-few-entries', message: expect.stringContaining('there are 2') });
    expect(narrativeGate(request([entry(0, 3)]))?.message).toContain('there is 1');
    expect(narrativeGate(request([entry(0, 3), entry(1, 5), entry(2, 6)]))).toBeNull();
  });

  it('counts only entries inside the range, by their own calendar date', () => {
    const entries = [entry(0, 3), entry(1, 5), { ...entry(2, 6), occurredAt: `${day(31)}T01:00:00.000+08:00` }];
    expect(narrativeGate(request(entries))?.reason).toBe('too-few-entries');
  });

  it('gates all-identical entries, ignoring time and list order', () => {
    const same = (n: number, sensations: Entry['sensations']) => entry(n, 4, { sensations, locations: ['Left lower back', 'Left buttock'] });
    const gate = narrativeGate(request([same(0, ['aching', 'tight']), same(2, ['tight', 'aching']), same(4, ['aching', 'tight'])]));
    expect(gate?.reason).toBe('all-identical');
    expect(gate?.message).toBe('All 3 check-ins in this range recorded the same thing: 4/10 in the left lower back and left buttock, '
      + 'described as aching and tight. A summary would only repeat that. Was anything different on any of these days, such as sleep, '
      + 'activity, or how the pain felt? Adding it to a check-in gives the summary something to describe.');
  });

  it('does not gate when any field differs, or when any entry has a note', () => {
    expect(narrativeGate(request([entry(0, 4), entry(1, 4), entry(2, 4, { sleep: 'poor' })]))).toBeNull();
    expect(narrativeGate(request([entry(0, 4), entry(1, 4), entry(2, 4, { note: 'Same as ever.' })]))).toBeNull();
  });
});

describe('computeFindings', () => {
  it('refuses input that the pre-gate would stop', () => {
    expect(() => computeFindings(request([entry(0, 3)]))).toThrow();
  });

  it('gives the overview from in-range entries', () => {
    const findings = computeFindings(request([entry(0, 2), entry(0, 6), entry(3, 4), entry(5, 9)]));
    expect(findings.range).toEqual({ from: day(0), to: day(29), days: 30 });
    expect(findings.overview).toEqual({ entryCount: 4, daysWithEntries: 3, intensity: { min: 2, median: 5, max: 9 } });
  });

  describe('trend', () => {
    const series = (values: number[]) => request(values.map((value, index) => entry(index, value)));

    it(`needs ${TREND_MIN_ENTRIES} entries`, () => {
      expect(computeFindings(series([1, 1, 9, 9, 9])).trend).toBeNull();
      expect(computeFindings(series([1, 1, 1, 9, 9, 9])).trend?.direction).toBe('up');
    });

    it(`reports a change of at least ${TREND_MIN_DELTA} points between half means, and nothing below it`, () => {
      expect(computeFindings(series([3, 3, 3, 5, 5, 5])).trend).toEqual({
        direction: 'up',
        firstHalf: { from: day(0), to: day(2), entries: 3, mean: 3 },
        secondHalf: { from: day(3), to: day(5), entries: 3, mean: 5 }
      });
      expect(computeFindings(series([3, 3, 3, 5, 5, 4])).trend).toBeNull();
      expect(computeFindings(series([7, 7, 7, 4, 5, 4])).trend?.direction).toBe('down');
    });
  });

  describe('associations', () => {
    it(`reports factors whose with/without means differ by at least ${ASSOCIATION_MIN_MEAN_DIFF}, with counts`, () => {
      const entries = [
        entry(0, 7, { sleep: 'poor' }), entry(1, 3, { sleep: 'good' }), entry(2, 8, { sleep: 'poor' }), entry(3, 4, { sleep: 'good' }),
        entry(4, 7, { sleep: 'poor' }), entry(5, 3, { sleep: 'okay' })
      ];
      expect(computeFindings(request(entries)).associations).toEqual([{
        factor: { kind: 'sleep', label: 'poor' },
        with: { entries: 3, mean: 7.3, highCount: 3 },
        without: { entries: 3, mean: 3.3, highCount: 0 }
      }]);
    });

    it('needs at least 3 entries with and without the factor', () => {
      const entries = [entry(0, 8, { activities: ['Lifting'] }), entry(1, 8, { activities: ['Lifting'] }), entry(2, 2), entry(3, 2), entry(4, 2)];
      expect(computeFindings(request(entries)).associations).toEqual([]);
    });

    it('scales the minimum support to 20% of entries', () => {
      // 20 entries: support must be 4, so a 3-entry factor is ignored.
      const entries = Array.from({ length: 20 }, (_, index) => entry(index, index < 3 ? 9 : 3, index < 3 ? { activities: ['Travel'] } : {}));
      expect(computeFindings(request(entries)).associations).toEqual([]);
    });

    it('never uses medications as a factor', () => {
      const medication = [{ name: 'Ibuprofen', perceivedEffect: 'helped' }];
      const entries = [entry(0, 8, { medications: medication }), entry(1, 8, { medications: medication }), entry(2, 8, { medications: medication }), entry(3, 2), entry(4, 2), entry(5, 2)];
      expect(computeFindings(request(entries)).associations).toEqual([]);
    });
  });

  describe('outliers', () => {
    it(`reports up to 2 entries at least ${OUTLIER_MIN_DEVIATION} points from the median`, () => {
      const findings = computeFindings(request([entry(0, 4), entry(1, 4), entry(2, 5), entry(3, 4), entry(4, 7)]));
      expect(findings.outliers).toEqual([{ date: day(4), intensity: 7 }]);
      expect(computeFindings(request([entry(0, 4), entry(1, 4), entry(2, 5), entry(3, 4), entry(4, 6)])).outliers).toEqual([]);
    });

    it('treats more than 2 as spread, not outliers', () => {
      expect(computeFindings(request([entry(0, 5), entry(1, 5), entry(2, 5), entry(3, 1), entry(4, 9), entry(5, 9)])).outliers).toEqual([]);
    });
  });

  describe('locations and sensations', () => {
    it('separates recurring, first recorded in range, and other labels', () => {
      const entries = [
        entry(0, 4, { sensations: ['aching'] }), entry(1, 4, { sensations: ['aching'], locations: ['Left lower back', 'Tailbone area'] }),
        entry(2, 4, { sensations: ['aching'] }), entry(3, 4), entry(4, 5, { sensations: ['sharp'] }), entry(5, 6, { sensations: ['sharp'] })
      ];
      const findings = computeFindings(request(entries));
      expect(findings.locations).toEqual({
        recurring: [{ label: 'Left lower back', entries: 6 }],
        firstRecordedInRange: [],
        other: [{ label: 'Tailbone area', entries: 1 }]
      });
      expect(findings.sensations).toEqual({
        recurring: [{ label: 'aching', entries: 3 }],
        firstRecordedInRange: [{ label: 'sharp', date: day(4), entries: 2 }],
        other: []
      });
    });
  });

  describe('gaps', () => {
    it(`reports ${DATA_GAP_MIN_DAYS}+ days without check-ins, including at the range edges`, () => {
      const entries = [entry(7, 4), entry(8, 5), entry(16, 6), entry(22, 4)];
      expect(computeFindings(request(entries, day(0), day(29))).gaps).toEqual([
        { lastCheckInBefore: null, nextCheckInAfter: day(7), daysWithoutCheckIns: 7 },
        { lastCheckInBefore: day(8), nextCheckInAfter: day(16), daysWithoutCheckIns: 7 },
        { lastCheckInBefore: day(22), nextCheckInAfter: null, daysWithoutCheckIns: 7 }
      ]);
      expect(computeFindings(request([entry(6, 4), entry(7, 5), entry(14, 6)], day(0), day(20))).gaps).toEqual([]);
    });
  });

  it('tallies treatments with the person\'s perceived-effect labels and no dose', () => {
    const findings = computeFindings(request([
      entry(0, 6, { medications: [{ name: 'Ibuprofen', perceivedEffect: 'helped' }], sensations: ['aching'] }),
      entry(1, 6, { medications: [{ name: 'ibuprofen', perceivedEffect: 'not-sure' }], sensations: ['aching', 'tight'] }),
      entry(2, 5, { medications: [{ name: 'Naproxen' }] }),
      entry(3, 7, { sensations: ['sharp'] })
    ]));
    expect(findings.treatments).toEqual([
      { name: 'Ibuprofen', entries: 2, perceivedEffects: { helped: 1, 'not sure yet': 1 }, sensationsOnSameCheckIns: [{ label: 'aching', entries: 2 }, { label: 'tight', entries: 1 }] },
      { name: 'Naproxen', entries: 1, perceivedEffects: {}, sensationsOnSameCheckIns: [] }
    ]);
  });

  it('groups locations and sensations first recorded on the same day', () => {
    const findings = computeFindings(request([
      entry(0, 4, { sensations: ['aching'] }), entry(1, 4, { sensations: ['aching'] }), entry(2, 4, { sensations: ['aching'] }),
      entry(3, 7, { locations: ['Left lower back', 'Tailbone area', 'Right lower back'], sensations: ['sharp'] }),
      entry(4, 4, { sensations: ['aching'] }), entry(5, 4, { sensations: ['aching', 'tight'] })
    ]));
    expect(findings.firstRecordedTogether).toEqual([{ date: day(3), locations: ['Right lower back', 'Tailbone area'], sensations: ['sharp'] }]);
  });

  it(`reports side-specific sensations only with ${SIDE_MIN_ENTRIES}+ check-ins per side and different top sensations`, () => {
    const left = (n: number, sensations: Entry['sensations']) => entry(n, 5, { locations: ['Left buttock'], sensations });
    const right = (n: number, sensations: Entry['sensations']) => entry(n, 5, { locations: ['Right buttock'], sensations });
    const base = [left(0, ['aching']), left(1, ['aching']), left(2, ['aching', 'tight']), right(3, ['tight']), right(4, ['tight'])];
    expect(computeFindings(request(base)).sensationsBySide).toEqual([]);
    expect(computeFindings(request([...base, right(5, ['sharp'])])).sensationsBySide).toEqual([
      { side: 'left', entries: 3, sensation: 'aching', sensationEntries: 3 },
      { side: 'right', entries: 3, sensation: 'tight', sensationEntries: 2 }
    ]);
    expect(computeFindings(request([...base, right(5, ['aching']), right(6, ['aching']), right(7, ['aching'])])).sensationsBySide).toEqual([]);
  });

  it(`sends notes newest first with their date, at most ${MAX_NOTES}`, () => {
    const entries = Array.from({ length: MAX_NOTES + 2 }, (_, index) => entry(index, 4 + (index % 3), { note: `Note ${index}` }));
    const findings = computeFindings(request(entries));
    expect(findings.notes).toHaveLength(MAX_NOTES);
    expect(findings.notes[0]).toEqual({ date: day(MAX_NOTES + 1), text: `Note ${MAX_NOTES + 1}` });
    expect(findings.omittedNotes).toBe(2);
  });

  it('contains no times of day', () => {
    const findings = computeFindings(request([entry(0, 2, { note: 'a' }), entry(1, 4), entry(2, 9)]));
    expect(JSON.stringify(findings)).not.toMatch(/T\d\d:\d\d/);
  });
});

describe('limitsSentence', () => {
  const base = computeFindings(request([entry(0, 3), entry(1, 4), entry(2, 5)]));

  it('names the strongest context association', () => {
    const findings = { ...base, associations: [
      { factor: { kind: 'location' as const, label: 'Left hip' }, with: base.associations[0]?.with ?? { entries: 3, mean: 7, highCount: 2 }, without: { entries: 3, mean: 3, highCount: 0 } },
      { factor: { kind: 'sleep' as const, label: 'poor' }, with: { entries: 3, mean: 7, highCount: 2 }, without: { entries: 3, mean: 3, highCount: 0 } }
    ] };
    expect(limitsSentence(findings)).toBe("This summary doesn't assess whether poor sleep affected pain ratings.");
  });

  it('falls back to the trend, then to a general sentence', () => {
    const trend = { direction: 'up' as const, firstHalf: { from: day(0), to: day(1), entries: 3, mean: 3 }, secondHalf: { from: day(2), to: day(3), entries: 3, mean: 6 } };
    expect(limitsSentence({ ...base, trend })).toBe("This summary doesn't assess what affected the change in ratings.");
    expect(limitsSentence(base)).toBe("This summary doesn't assess what affected these ratings.");
  });
});

describe('countWords', () => {
  it('counts whitespace-separated words', () => {
    expect(countWords('  **Change over time:** rose\n\n- one ')).toBe(6);
    expect(countWords('')).toBe(0);
  });
});
