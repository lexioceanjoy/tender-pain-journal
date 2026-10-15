import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { painEntrySchema } from './painEntry';
import {
  buildDemoEntries, getSeededDemoIds, hasDemoDataDecisionBeenMade,
  recordDemoCleared, recordDemoSeeded
} from './demoData';

function fakeLocalStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
    clear: () => data.clear()
  };
}

describe('buildDemoEntries', () => {
  it('produces several valid, distinct entries spanning more than one body region', () => {
    const entries = buildDemoEntries();
    expect(entries.length).toBeGreaterThan(3);
    for (const entry of entries) expect(() => painEntrySchema.parse(entry)).not.toThrow();
    const ids = new Set(entries.map((entry) => entry.id));
    expect(ids.size).toBe(entries.length);
    const regions = new Set(entries.flatMap((entry) => entry.regions));
    expect(regions.size).toBeGreaterThan(1);
  });
});

describe('demo data decision tracking', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports no decision made yet before any seed/clear call', () => {
    expect(hasDemoDataDecisionBeenMade()).toBe(false);
  });

  it('remembers a decision after seeding, and exposes the seeded ids', () => {
    recordDemoSeeded(['a', 'b']);
    expect(hasDemoDataDecisionBeenMade()).toBe(true);
    expect(getSeededDemoIds()).toEqual(['a', 'b']);
  });

  it('remembers a decision after clearing, and drops the seeded ids so they cannot return', () => {
    recordDemoSeeded(['a', 'b']);
    recordDemoCleared();
    expect(hasDemoDataDecisionBeenMade()).toBe(true);
    expect(getSeededDemoIds()).toEqual([]);
  });

  it('treats a missing localStorage as a decision already made, so seeding never runs without a way to clear it', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(hasDemoDataDecisionBeenMade()).toBe(true);
  });
});
