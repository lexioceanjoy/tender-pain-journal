import { describe, expect, it } from 'vitest';
import type { PainEntry } from '../../shared/data/painEntry';
import { buildInsights } from './insights';

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

    expect(result.commonRegions).toContainEqual({
      id: 'foot-left',
      label: 'Left foot',
      count: 1,
      averageIntensity: 2
    });
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
});
