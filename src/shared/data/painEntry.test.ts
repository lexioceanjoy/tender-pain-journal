import { describe, expect, it } from 'vitest';
import { createPainEntry, repeatPainEntryInput, updatePainEntry } from './painEntry';

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
});
