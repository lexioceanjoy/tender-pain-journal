import { describe, expect, it } from 'vitest';
import { createPainEntry } from '../../shared/data/painEntry';
import { buildAiSummaryRequest, withLocalOffset } from './aiSummary';

describe('AI summary payload', () => {
  it('sends only the selected entries in a labelled, validated shape', () => {
    const entry = createPainEntry({
      occurredAt: '2026-08-01T08:00:00.000Z',
      regions: ['choir-b23'],
      precisionAreas: ['tender-detail-si-left'],
      intensity: 7,
      activities: ['Walking'],
      note: 'Improved later.'
    });

    const request = buildAiSummaryRequest([entry], '2026-08-01', '2026-08-07');

    expect(request.entries[0]).toMatchObject({
      intensity: 7,
      locations: ['Left buttock'],
      refinedLocations: ['Left SI-joint area'],
      activities: ['Walking'],
      note: 'Improved later.'
    });
    expect(request.entries[0]).not.toHaveProperty('id');
    expect(request.entries[0]).not.toHaveProperty('createdAt');
  });
});

describe('local-offset check-in times', () => {
  it('keeps the same instant but writes the local date and offset', () => {
    expect(withLocalOffset('2026-08-01T03:30:00.000Z', -420)).toBe('2026-07-31T20:30:00.000-07:00');
    expect(withLocalOffset('2026-08-01T20:30:00.000Z', 330)).toBe('2026-08-02T02:00:00.000+05:30');
    expect(withLocalOffset('2026-08-01T20:30:00.000Z', 0)).toBe('2026-08-01T20:30:00.000Z');
    expect(Date.parse(withLocalOffset('2026-08-01T03:30:00.000Z', -420))).toBe(Date.parse('2026-08-01T03:30:00.000Z'));
  });

  it('never sends a medication dose', () => {
    const entry = createPainEntry({ regions: ['choir-b23'], intensity: 5, medication: { name: 'Ibuprofen', dose: '200 mg', perceivedEffect: 'helped' } });
    expect(buildAiSummaryRequest([entry], '2026-08-01', '2026-08-07').entries[0].medications).toEqual([{ name: 'Ibuprofen', perceivedEffect: 'helped' }]);
  });
});
