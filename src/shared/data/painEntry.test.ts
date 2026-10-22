import { describe, expect, it } from 'vitest';
import { createPainEntry, painEntrySchema, repeatPainEntryInput, updatePainEntry } from './painEntry';

describe('pain entries', () => {
  it('records an explicitly chosen occurrence time', () => {
    const occurredAt = '2026-07-20T08:30:00.000Z';
    const entry = createPainEntry({ regions: ['choir-b18'], intensity: 6, occurredAt });
    expect(entry.occurredAt).toBe(occurredAt);
  });

  it('updates content without changing the private identity or creation time', () => {
    const original = createPainEntry({
      regions: ['choir-b18'],
      intensity: 6,
      occurredAt: '2026-07-20T08:30:00.000Z'
    });
    const updated = updatePainEntry(original, {
      regions: ['choir-b18', 'choir-b23'],
      intensity: 4,
      occurredAt: '2026-07-20T09:15:00.000Z',
      note: 'Improved after walking.'
    });

    expect(updated.id).toBe(original.id);
    expect(updated.createdAt).toBe(original.createdAt);
    expect(updated.occurredAt).toBe('2026-07-20T09:15:00.000Z');
    expect(updated.intensity).toBe(4);
    expect(updated.note).toBe('Improved after walking.');
  });

  it('repeats pain-specific details without carrying one-off context or notes', () => {
    const original = createPainEntry({
      regions: ['choir-b18', 'choir-b23'],
      intensity: 7,
      occurredAt: '2026-07-20T08:30:00.000Z',
      sensations: ['aching'],
      activities: ['Travel'],
      sleep: 'poor',
      medication: { name: 'Ibuprofen', dose: '200 mg', perceivedEffect: 'helped' },
      areaDetails: [{ regionId: 'choir-b23', intensity: 4, sensations: ['numb'] }],
      precisionAreas: ['tender-detail-si-left'],
      note: 'One-off detail'
    });

    const repeated = repeatPainEntryInput(original, '2026-07-21T09:00:00.000Z');

    expect(repeated).toMatchObject({
      regions: ['choir-b18', 'choir-b23'],
      intensity: 7,
      occurredAt: '2026-07-21T09:00:00.000Z',
      sensations: ['aching'],
      areaDetails: [{ regionId: 'choir-b23', intensity: 4, sensations: ['numb'] }],
      precisionAreas: ['tender-detail-si-left']
    });
    expect(repeated.activities).toBeUndefined();
    expect(repeated.sleep).toBeUndefined();
    expect(repeated.medication).toBeUndefined();
    expect(repeated.note).toBeUndefined();
  });

  describe('check-in gaps fields', () => {
    const full = () => createPainEntry({
      regions: ['choir-b18'], intensity: 6, activities: ['Long sitting', 'Poor sleep'],
      interference: 'a-lot', interferenceAreas: ['work'], activityEffects: { 'Long sitting': 'worse' },
      areaPatterns: [{ regionId: 'choir-b18', pattern: 'comes-and-goes' }], painWokeMe: true
    });

    it('writes new entries as version 2 and stores nothing new by default', () => {
      const entry = createPainEntry({ regions: ['choir-b18'], intensity: 6 });
      expect(entry.schemaVersion).toBe(2);
      expect(entry.areaPatterns).toBeUndefined();
      expect(JSON.stringify(entry)).not.toMatch(/interference|activityEffects|painWokeMe|areaPatterns/);
    });

    it('still accepts an untouched version 1 entry', () => {
      const v1 = { ...createPainEntry({ regions: ['choir-b18'], intensity: 6 }), schemaVersion: 1 };
      expect(painEntrySchema.parse(v1).schemaVersion).toBe(1);
      expect(updatePainEntry(painEntrySchema.parse(v1), { regions: ['choir-b18'], intensity: 5 }).schemaVersion).toBe(2);
    });

    it('drops life areas below "a lot", and markers for unselected activities or Poor sleep', () => {
      const entry = createPainEntry({
        regions: ['choir-b18'], intensity: 6, activities: ['Walking', 'Poor sleep'], interference: 'a-little',
        interferenceAreas: ['work'], activityEffects: { Walking: 'helped', 'Poor sleep': 'worse', Travel: 'worse' }
      });
      expect(entry.context?.interferenceAreas).toBeUndefined();
      expect(entry.context?.activityEffects).toEqual({ Walking: 'helped' });
    });

    it('rejects invalid combinations', () => {
      const entry = full();
      const reject = (change: (copy: any) => void) => {
        const copy = structuredClone(entry);
        change(copy);
        expect(painEntrySchema.safeParse(copy).success).toBe(false);
      };
      expect(painEntrySchema.safeParse(entry).success).toBe(true);
      reject((copy) => { copy.context.interference = 'a-little'; });
      reject((copy) => { copy.context.activityEffects = { Walking: 'worse' }; });
      reject((copy) => { copy.context.activityEffects = { 'Poor sleep': 'worse' }; });
      reject((copy) => { copy.areaPatterns = [{ regionId: 'choir-b23', pattern: 'steady' }]; });
      reject((copy) => { copy.context.painWokeMe = false; });
    });

    it('repeats patterns but not impact, markers, or "Pain woke me"', () => {
      const repeated = repeatPainEntryInput(full());
      expect(repeated.areaPatterns).toEqual([{ regionId: 'choir-b18', pattern: 'comes-and-goes' }]);
      expect(repeated.interference).toBeUndefined();
      expect(repeated.activityEffects).toBeUndefined();
      expect(repeated.painWokeMe).toBeUndefined();
    });
  });
});
