import { describe, expect, it } from 'vitest';
import { createPainEntry } from '../../shared/data/painEntry';
import { buildAiSummaryRequest } from './aiSummary';

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
