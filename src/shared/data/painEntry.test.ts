import { describe, expect, it } from 'vitest';
import { createPainEntry, updatePainEntry } from './painEntry';

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
});
