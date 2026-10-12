import { afterEach, describe, expect, it, vi } from 'vitest';
import { dateDaysAgo } from './InsightsPanel';

describe('dateDaysAgo', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('returns the local calendar day, not the UTC day, late in the evening in a UTC-negative zone', () => {
    vi.stubEnv('TZ', 'America/New_York');
    vi.useFakeTimers();
    // 9pm local in New York (EDT, UTC-4) is already the next UTC day.
    vi.setSystemTime(new Date('2026-07-20T21:00:00-04:00'));

    expect(dateDaysAgo(0)).toBe('2026-07-20');
  });

  it('returns the local calendar day, not the UTC day, early in the morning in a UTC-positive zone', () => {
    vi.stubEnv('TZ', 'Asia/Shanghai');
    vi.useFakeTimers();
    // 1am local in Shanghai (UTC+8) is still the previous UTC day.
    vi.setSystemTime(new Date('2026-07-21T01:00:00+08:00'));

    expect(dateDaysAgo(0)).toBe('2026-07-21');
  });

  it('subtracts whole local calendar days', () => {
    vi.stubEnv('TZ', 'America/New_York');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T21:00:00-04:00'));

    expect(dateDaysAgo(29)).toBe('2026-06-21');
  });
});
