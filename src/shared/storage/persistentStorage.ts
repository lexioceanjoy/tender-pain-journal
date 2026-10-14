export type PersistenceStatus = 'granted' | 'denied' | 'unsupported';

export type StorageEstimate = {
  usageBytes?: number;
  quotaBytes?: number;
};

const REQUESTED_KEY = 'tender-storage-persist-status';

function readStoredStatus(): PersistenceStatus | null {
  try {
    const raw = localStorage.getItem(REQUESTED_KEY);
    return raw === 'granted' || raw === 'denied' || raw === 'unsupported' ? raw : null;
  } catch {
    return null;
  }
}

function writeStoredStatus(status: PersistenceStatus) {
  try {
    localStorage.setItem(REQUESTED_KEY, status);
  } catch {
    // Non-fatal — the request may simply fire again next session.
  }
}

// Requests persistent storage exactly once, ever, on this device — the
// caller decides *when* that first call happens (after the first
// successful save, never on mount/page load). Later calls, including
// across page reloads, return the stored result without asking the
// browser again. Feature-detects navigator.storage/.persist and never
// throws: an unsupported browser is a normal, expected case, not an error.
export async function requestPersistentStorageOnce(): Promise<PersistenceStatus> {
  const stored = readStoredStatus();
  if (stored) return stored;

  if (!navigator.storage?.persist) {
    writeStoredStatus('unsupported');
    return 'unsupported';
  }

  let granted = false;
  try {
    granted = await navigator.storage.persist();
  } catch {
    granted = false;
  }

  const status: PersistenceStatus = granted ? 'granted' : 'denied';
  writeStoredStatus(status);
  return status;
}

// Pure read of whatever requestPersistentStorageOnce() already decided,
// without triggering a new request. null means no check-in has ever
// triggered the request yet.
export function getStoredPersistenceStatus(): PersistenceStatus | null {
  return readStoredStatus();
}

// Safe to call any time, as often as needed — unlike persist(), estimate()
// has no permission prompt and no side effects, so the UI can read a fresh
// number on every render instead of relying on a stale one-time snapshot.
export async function readStorageEstimate(): Promise<StorageEstimate> {
  try {
    if (!navigator.storage?.estimate) return {};
    const estimate = await navigator.storage.estimate();
    const usageBytes = Number.isFinite(estimate.usage) ? estimate.usage : undefined;
    const quotaBytes = Number.isFinite(estimate.quota) && (estimate.quota ?? 0) > 0 ? estimate.quota : undefined;
    return { usageBytes, quotaBytes };
  } catch {
    return {};
  }
}
