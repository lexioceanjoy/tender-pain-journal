import { useEffect, useState } from 'react';
import {
  getStoredPersistenceStatus,
  readStorageEstimate,
  type PersistenceStatus,
  type StorageEstimate
} from '../../shared/storage/persistentStorage';

function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  return `${Math.max(bytes / 1024, 0).toFixed(0)} KB`;
}

// Draft copy — pending sign-off. Load-bearing honesty rule: none of these
// may imply data survives the user clearing this site's data. It does not,
// in any of the three states.
function statusCopy(status: PersistenceStatus) {
  if (status === 'granted') {
    return 'This browser has granted persistent storage, which lowers the chance it will clear your check-ins automatically under storage pressure. Clearing this site’s data in your browser settings will still delete them.';
  }
  if (status === 'denied') {
    return 'This browser did not grant persistent storage. Your check-ins are still saved locally, but the browser may clear them automatically if device storage runs low.';
  }
  return 'This browser doesn’t support requesting persistent storage. Your check-ins are saved locally as usual.';
}

export function StorageStatusLine() {
  const [status, setStatus] = useState<PersistenceStatus | null>(null);
  const [estimate, setEstimate] = useState<StorageEstimate>({});

  useEffect(() => {
    setStatus(getStoredPersistenceStatus());
    readStorageEstimate().then(setEstimate);
  }, []);

  if (!status) return null;

  const showEstimate = estimate.usageBytes !== undefined && estimate.quotaBytes !== undefined;

  return (
    <p className="storage-status-line">
      {statusCopy(status)}
      {showEstimate && ` Using about ${formatBytes(estimate.usageBytes as number)} of an estimated ${formatBytes(estimate.quotaBytes as number)} available.`}
    </p>
  );
}
