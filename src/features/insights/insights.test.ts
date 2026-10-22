import { describe, expect, it } from 'vitest';
import type { PainEntry } from '../../shared/data/painEntry';
import { NEW_AREA_LOOKBACK_DAYS, NEW_AREAS_SHOWN, RUN_GAP_DAYS, buildInsights, newAreasForDisplay, regionTiming } from './insights';

const base: PainEntry = {
  id: 'one',
  schemaVersion: 1,
  createdAt: '2026-07-20T10:00:00+08:00',
  updatedAt: '2026-07-20T10:00:00+08:00',
  occurredAt: '2026-07-20T10:00:00+08:00',
  regions: ['back-low-left'],
  intensity: 8,
  context: { activities: ['Long sitting'] }
};

describe('private insights', () => {
  it('summarizes only entries in the chosen range', () => {
    const result = buildInsights([
      base,
      { ...base, id: 'two', occurredAt: '2026-07-21T10:00:00+08:00', intensity: 4 },
      { ...base, id: 'outside', occurredAt: '2026-06-01T10:00:00+08:00' }
    ], '2026-07-20', '2026-07-21');

    expect(result.entries).toHaveLength(2);
    expect(result.averageIntensity).toBe(6);
    expect(result.highPainEntries).toBe(1);
    expect(result.commonRegions[0]).toMatchObject({ label: 'Left low back', count: 2, averageIntensity: 6 });
  });

  it('uses area-specific intensity when calculating location averages', () => {
    const result = buildInsights([{
      ...base,
      regions: ['back-low-left', 'foot-left'],
      areaDetails: [{ regionId: 'foot-left', intensity: 2, sensations: ['tingling'] }]
    }], '2026-07-20', '2026-07-20');

    expect(result.commonRegions).toContainEqual(expect.objectContaining({
      id: 'foot-left',
      label: 'Left foot',
      count: 1,
      averageIntensity: 2
    }));
  });

  it('summarizes refined Tender detail locations separately', () => {
    const result = buildInsights([{
      ...base,
      regions: ['choir-b23'],
      precisionAreas: ['tender-detail-si-left']
    }], '2026-07-20', '2026-07-20');

    expect(result.commonPrecisionAreas).toContainEqual({
      id: 'tender-detail-si-left',
      label: 'Left SI-joint area',
      count: 1
    });
  });

  describe('check-in gaps', () => {
    const at = (day: string, id: string, extra: Partial<PainEntry> = {}): PainEntry => ({
      ...base, id, occurredAt: `${day}T10:00:00`, createdAt: `${day}T10:00:00Z`, updatedAt: `${day}T10:00:00Z`, ...extra
    });

    it('calls an area new only after the full lookback without it', () => {
      expect(NEW_AREA_LOOKBACK_DAYS).toBe(30);
      const prior = at('2026-06-20', 'prior'); // 30 days before 07-20: still "recent"
      expect(buildInsights([prior, at('2026-07-20', 'now')], '2026-07-20', '2026-07-21').newAreas).toEqual([]);
      const older = at('2026-06-19', 'older'); // 31 days before
      expect(buildInsights([older, at('2026-07-20', 'now')], '2026-07-20', '2026-07-21').newAreas)
        .toEqual([{ id: 'back-low-left', label: 'Left low back', firstRecorded: '2026-07-20' }]);
    });

    it('hides "New in this period" when every area is new, otherwise caps it', () => {
      const firstPeriod = buildInsights([at('2026-07-20', 'a'), at('2026-07-21', 'b', { regions: ['foot-left'] })], '2026-07-20', '2026-07-21');
      expect(firstPeriod.allAreasNew).toBe(true);
      expect(newAreasForDisplay(firstPeriod)).toBeNull();

      const fresh = ['foot-left', 'foot-right', 'knee-left', 'knee-right', 'hand-left'];
      const later = buildInsights([
        at('2026-07-01', 'old'),
        at('2026-07-20', 'again'),
        ...fresh.map((region, index) => at('2026-07-21', `new-${index}`, { regions: [region] }))
      ], '2026-07-20', '2026-07-21');
      expect(later.allAreasNew).toBe(false);
      expect(newAreasForDisplay(later)).toMatchObject({ more: fresh.length - NEW_AREAS_SHOWN });
      expect(newAreasForDisplay(later)!.shown).toHaveLength(NEW_AREAS_SHOWN);
    });

    it('starts "recorded since" after a gap longer than the run gap', () => {
      expect(RUN_GAP_DAYS).toBe(14);
      const entries = [at('2026-06-01', 'a'), at('2026-07-01', 'b'), at('2026-07-15', 'c'), at('2026-07-20', 'd')];
      const region = buildInsights(entries, '2026-07-15', '2026-07-20').commonRegions[0];
      expect(region).toMatchObject({ recordedSince: '2026-07-01', daysRecordedSince: 3, daysInRun: 20 });
      expect(regionTiming(region)).toMatch(/^since .+ · recorded on 3 of 20 days$/);
    });

    it('labels a mostly-recorded pattern, and nothing below half', () => {
      const steady = { areaPatterns: [{ regionId: 'back-low-left', pattern: 'steady' as const }] };
      expect(buildInsights([at('2026-07-20', 'a', steady), at('2026-07-21', 'b')], '2026-07-20', '2026-07-21').commonRegions[0].mostlyPattern).toBe('steady');
      expect(buildInsights([at('2026-07-20', 'a', steady), at('2026-07-21', 'b'), at('2026-07-21', 'c')], '2026-07-20', '2026-07-21').commonRegions[0].mostlyPattern).toBeUndefined();
    });

    it('counts interference by day at the highest level, and nights pain woke the person', () => {
      const result = buildInsights([
        at('2026-07-20', 'a', { context: { interference: 'a-little', sleep: 'poor', painWokeMe: true } }),
        at('2026-07-20', 'b', { context: { interference: 'a-lot', interferenceAreas: ['work'] } }),
        at('2026-07-21', 'c', { context: { interference: 'none', sleep: 'good' } }),
        at('2026-07-21', 'd')
      ], '2026-07-20', '2026-07-21');
      expect(result.interference).toEqual({ days: 2, levels: { none: 1, 'a-little': 0, 'a-lot': 1, unable: 0 }, areas: [{ area: 'work', days: 1 }] });
      expect(result.painWoke).toEqual({ nights: 1, ofNights: 2 });
    });

    it('counts the person\'s activity markers', () => {
      const result = buildInsights([
        at('2026-07-20', 'a', { context: { activities: ['Long sitting'], activityEffects: { 'Long sitting': 'worse' } } }),
        at('2026-07-21', 'b', { context: { activities: ['Long sitting'] } })
      ], '2026-07-20', '2026-07-21');
      expect(result.commonActivities[0]).toEqual({ label: 'Long sitting', count: 2, worse: 1, helped: 0 });
    });
  });
});
