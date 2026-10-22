import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPainEntry } from '../../shared/data/painEntry';
import { buildExportCsv, buildExportJson, exportFilename } from './export';

describe('buildExportJson / buildExportCsv', () => {
  it('includes entries outside any currently-displayed date range', () => {
    const old = createPainEntry({ occurredAt: '2020-01-01T08:00:00.000Z', regions: ['choir-b23'], intensity: 3 });
    const recent = createPainEntry({ occurredAt: '2026-08-01T08:00:00.000Z', regions: ['choir-b23'], intensity: 7 });

    const json = JSON.parse(buildExportJson([old, recent]));
    expect(json.entries).toHaveLength(2);
    expect(json.entries.map((entry: { id: string }) => entry.id).sort()).toEqual([old.id, recent.id].sort());

    const csv = buildExportCsv([old, recent]);
    expect(csv.split('\r\n')).toHaveLength(3); // header + 2 rows
    expect(csv).toContain(old.id);
    expect(csv).toContain(recent.id);
  });

  it('uses human-readable region and precision-area labels, never raw IDs', () => {
    const entry = createPainEntry({
      regions: ['choir-b23'],
      precisionAreas: ['tender-detail-si-left'],
      intensity: 7
    });

    const json = JSON.parse(buildExportJson([entry]));
    expect(json.entries[0].regions).toEqual(['Left buttock']);
    expect(json.entries[0].precisionAreas).toEqual(['Left SI-joint area']);
    expect(JSON.stringify(json)).not.toContain('choir-b23');
    expect(JSON.stringify(json)).not.toContain('tender-detail-si-left');

    const csv = buildExportCsv([entry]);
    expect(csv).toContain('Left buttock');
    expect(csv).toContain('Left SI-joint area');
    expect(csv).not.toContain('choir-b23');
    expect(csv).not.toContain('tender-detail-si-left');
  });

  it('escapes commas, quotes, and newlines in free-text CSV fields', () => {
    const entry = createPainEntry({
      regions: ['choir-b23'],
      intensity: 5,
      note: 'Worse after sitting, "really" bad —\nimproved by evening.'
    });

    const csv = buildExportCsv([entry]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    const noteField = '"Worse after sitting, ""really"" bad —\nimproved by evening."';
    expect(lines[1]).toContain(noteField);
  });

  it('escapes a plain comma in an activity label', () => {
    const entry = createPainEntry({ regions: ['choir-b23'], intensity: 4, activities: ['Sitting, then standing'] });
    const csv = buildExportCsv([entry]);
    expect(csv).toContain('"Sitting, then standing"');
  });
});

describe('exportFilename', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('uses the local calendar day, not the UTC day, late in the evening in a UTC-negative zone', () => {
    vi.stubEnv('TZ', 'America/New_York');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T21:00:00-04:00'));

    expect(exportFilename('json')).toBe('tender-export-2026-07-20.json');
    expect(exportFilename('csv')).toBe('tender-export-2026-07-20.csv');
  });

  it('exports the check-in-gaps fields as their own columns', () => {
    const entry = createPainEntry({
      regions: ['choir-b18'], intensity: 6, activities: ['Long sitting'], interference: 'a-lot',
      interferenceAreas: ['work', 'chores'], activityEffects: { 'Long sitting': 'worse' },
      areaPatterns: [{ regionId: 'choir-b18', pattern: 'comes-and-goes' }], painWokeMe: true
    });
    const [header, row] = buildExportCsv([entry]).split('\r\n');
    const columns = header.split(',');
    const values = Object.fromEntries(columns.map((column, index) => [column, row.split(',')[index]]));
    expect(values).toMatchObject({ interference: 'a-lot', interferenceAreas: 'work; chores', activityEffects: 'Long sitting: worse', painWokeMe: 'true' });
    expect(values.areaPatterns).toMatch(/: comes-and-goes$/);
  });
});
