import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStoredPersistenceStatus, readStorageEstimate, requestPersistentStorageOnce } from './persistentStorage';

// This sandbox's localStorage is a non-functional stub (getItem/setItem/
// etc. are all `undefined`), which persistentStorage.ts already tolerates
// via try/catch — but these tests need a *working* store to exercise the
// "ask once, then cache" behavior deterministically.
function fakeLocalStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
    clear: () => data.clear()
  };
}

describe('requestPersistentStorageOnce', () => {
  const originalStorage = Object.getOwnPropertyDescriptor(navigator, 'storage');

  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalStorage) Object.defineProperty(navigator, 'storage', originalStorage);
    else delete (navigator as { storage?: unknown }).storage;
  });

  it('reports unsupported, without throwing, when the Storage API is absent', async () => {
    Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true });

    await expect(requestPersistentStorageOnce()).resolves.toBe('unsupported');
    expect(getStoredPersistenceStatus()).toBe('unsupported');
  });

  it('reports unsupported, without throwing, when persist is absent from navigator.storage', async () => {
    Object.defineProperty(navigator, 'storage', { value: {}, configurable: true });

    await expect(requestPersistentStorageOnce()).resolves.toBe('unsupported');
  });

  it('reports denied when persist() resolves false', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { persist: vi.fn().mockResolvedValue(false) },
      configurable: true
    });

    await expect(requestPersistentStorageOnce()).resolves.toBe('denied');
    expect(getStoredPersistenceStatus()).toBe('denied');
  });

  it('reports denied, without throwing, when persist() rejects', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { persist: vi.fn().mockRejectedValue(new Error('denied by policy')) },
      configurable: true
    });

    await expect(requestPersistentStorageOnce()).resolves.toBe('denied');
  });

  it('reports granted when persist() resolves true', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { persist: vi.fn().mockResolvedValue(true) },
      configurable: true
    });

    await expect(requestPersistentStorageOnce()).resolves.toBe('granted');
  });

  it('only asks the browser once; later calls return the stored result', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true });

    await requestPersistentStorageOnce();
    await requestPersistentStorageOnce();
    await requestPersistentStorageOnce();

    expect(persist).toHaveBeenCalledOnce();
  });
});

describe('readStorageEstimate', () => {
  const originalStorage = Object.getOwnPropertyDescriptor(navigator, 'storage');

  afterEach(() => {
    if (originalStorage) Object.defineProperty(navigator, 'storage', originalStorage);
    else delete (navigator as { storage?: unknown }).storage;
  });

  it('returns an empty object, without throwing, when estimate is unavailable', async () => {
    Object.defineProperty(navigator, 'storage', { value: {}, configurable: true });
    await expect(readStorageEstimate()).resolves.toEqual({});
  });

  it('returns an empty object, without throwing, when estimate() rejects', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: vi.fn().mockRejectedValue(new Error('unavailable')) },
      configurable: true
    });
    await expect(readStorageEstimate()).resolves.toEqual({});
  });

  it('returns usage and quota when both are meaningful numbers', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: vi.fn().mockResolvedValue({ usage: 1024, quota: 500_000_000 }) },
      configurable: true
    });
    await expect(readStorageEstimate()).resolves.toEqual({ usageBytes: 1024, quotaBytes: 500_000_000 });
  });

  it('omits a zero or missing quota rather than showing a meaningless number', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: vi.fn().mockResolvedValue({ usage: 1024, quota: 0 }) },
      configurable: true
    });
    await expect(readStorageEstimate()).resolves.toEqual({ usageBytes: 1024 });
  });
});
