import { describe, expect, it } from 'vitest';
import { findBodyRegion, getBodyRegions } from './bodyRegions';

describe('CHOIR body regions', () => {
  it('preserves all 74 source regions for both outlines', () => {
    for (const outline of ['female', 'male'] as const) {
      expect(getBodyRegions(outline, 'front')).toHaveLength(36);
      expect(getBodyRegions(outline, 'back')).toHaveLength(38);
    }
  });

  it('uses the same stable IDs for either outline', () => {
    expect(getBodyRegions('female', 'front').map(({ id }) => id))
      .toEqual(getBodyRegions('male', 'front').map(({ id }) => id));
    expect(getBodyRegions('female', 'back').map(({ id }) => id))
      .toEqual(getBodyRegions('male', 'back').map(({ id }) => id));
  });

  it('continues to resolve labels from prototype-era entries', () => {
    expect(findBodyRegion('back-low-left')?.label).toBe('Left low back');
    expect(findBodyRegion('choir-b18')?.label).toBe('Left lower back');
  });
});
