import { describe, expect, it } from 'vitest';
import { createPainEntry } from '../../shared/data/painEntry';
import { createBackup, parseBackup } from './backup';

describe('Tender backup', () => {
  it('round-trips a valid entry', () => {
    const entry = createPainEntry({
      regions: ['back-low-left', 'foot-left'],
      intensity: 6,
      sensations: ['aching'],
      precisionAreas: ['tender-detail-si-left'],
      areaDetails: [{ regionId: 'foot-left', intensity: 2, sensations: ['tingling'] }]
    });
    expect(parseBackup(createBackup([entry]))).toEqual([entry]);
  });

  it('rejects an unrelated JSON file', () => {
    expect(() => parseBackup('{"entries":[]}')).toThrow();
  });

  it('rejects area details that do not belong to a selected region', () => {
    const entry = createPainEntry({ regions: ['back-low-left'], intensity: 6 });
    const invalid = JSON.parse(createBackup([entry]));
    invalid.entries[0].areaDetails = [{ regionId: 'foot-left', intensity: 2 }];
    expect(() => parseBackup(JSON.stringify(invalid))).toThrow();
  });

  it('rejects duplicated refined locations', () => {
    const entry = createPainEntry({ regions: ['choir-b23'], intensity: 6 });
    const invalid = JSON.parse(createBackup([entry]));
    invalid.entries[0].precisionAreas = ['tender-detail-si-left', 'tender-detail-si-left'];
    expect(() => parseBackup(JSON.stringify(invalid))).toThrow();
  });

  it('writes version 2, round-trips every new field, and still reads a version 1 backup', () => {
    const entry = createPainEntry({
      regions: ['choir-b18'], intensity: 6, activities: ['Long sitting'], interference: 'unable',
      interferenceAreas: ['work', 'social'], activityEffects: { 'Long sitting': 'worse' },
      areaPatterns: [{ regionId: 'choir-b18', pattern: 'steady' }], painWokeMe: true
    });
    const backup = createBackup([entry]);
    expect(JSON.parse(backup).schemaVersion).toBe(2);
    expect(parseBackup(backup)).toEqual([entry]);
    const v1 = { ...createPainEntry({ regions: ['choir-b18'], intensity: 4 }), schemaVersion: 1 };
    expect(parseBackup(JSON.stringify({ app: 'Tender', schemaVersion: 1, exportedAt: new Date().toISOString(), entries: [v1] }))).toEqual([v1]);
  });
});
