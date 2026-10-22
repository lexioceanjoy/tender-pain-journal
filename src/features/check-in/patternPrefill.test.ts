import { describe, expect, it } from 'vitest';
import { createPainEntry } from '../../shared/data/painEntry';
import { patternPrefill, patternsToSave } from './patternPrefill';

describe('steady / comes-and-goes pre-fill', () => {
  const older = createPainEntry({ regions: ['choir-b18'], intensity: 5, occurredAt: '2026-07-01T09:00:00.000Z', areaPatterns: [{ regionId: 'choir-b18', pattern: 'steady' }] });
  const newer = createPainEntry({ regions: ['choir-b18'], intensity: 5, occurredAt: '2026-07-05T09:00:00.000Z', areaPatterns: [{ regionId: 'choir-b18', pattern: 'comes-and-goes' }] });
  const later = createPainEntry({ regions: ['choir-b18'], intensity: 5, occurredAt: '2026-07-20T09:00:00.000Z', areaPatterns: [{ regionId: 'choir-b18', pattern: 'steady' }] });

  it('uses the most recent earlier check-in that recorded a pattern', () => {
    expect(patternPrefill([older, newer, later], ['choir-b18', 'choir-b23'], '2026-07-10T09:00:00.000Z')).toEqual({ 'choir-b18': 'comes-and-goes' });
  });

  it('saves a pre-filled value only if Add context was opened', () => {
    const prefill = { 'choir-b18': 'steady' as const };
    expect(patternsToSave(['choir-b18'], { areaPatterns: {} }, prefill, false)).toEqual([]);
    expect(patternsToSave(['choir-b18'], { areaPatterns: {} }, prefill, true)).toEqual([{ regionId: 'choir-b18', pattern: 'steady' }]);
  });

  it('saves a choice, honours a cleared chip, and ignores unselected regions', () => {
    const prefill = { 'choir-b18': 'steady' as const };
    expect(patternsToSave(['choir-b18'], { areaPatterns: { 'choir-b18': 'comes-and-goes' } }, prefill, false)).toEqual([{ regionId: 'choir-b18', pattern: 'comes-and-goes' }]);
    expect(patternsToSave(['choir-b18'], { areaPatterns: { 'choir-b18': null } }, prefill, true)).toEqual([]);
    expect(patternsToSave([], { areaPatterns: { 'choir-b18': 'steady' } }, prefill, true)).toEqual([]);
  });
});
