import { useRef, useState } from 'react';
import type { PainEntry } from '../../shared/data/painEntry';
import { createBackup, parseBackup } from './backup';

const LAST_BACKUP_KEY = 'tender-last-backup-at';
const BACKUP_REMINDER_DAYS = 14;

type Props = {
  entries: PainEntry[];
  onImport: (entries: PainEntry[]) => Promise<void>;
};

export function BackupPanel({ entries, onImport }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>('');
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_BACKUP_KEY);
    } catch {
      return null;
    }
  });

  function exportBackup() {
    const file = new Blob([createBackup(entries)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tender-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    const exportedAt = new Date().toISOString();
    try {
      localStorage.setItem(LAST_BACKUP_KEY, exportedAt);
    } catch {
      // The download still works if preference storage is unavailable.
    }
    setLastBackupAt(exportedAt);
    setStatus('Backup downloaded. Keep it somewhere you control.');
  }

  async function importBackup(file?: File) {
    if (!file) return;
    try {
      const imported = parseBackup(await file.text());
      await onImport(imported);
      setStatus(`${imported.length} ${imported.length === 1 ? 'entry' : 'entries'} imported. Existing records were kept.`);
    } catch {
      setStatus('That file is not a valid Tender backup. Nothing was changed.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <details className="backup-panel">
      <summary>Backup & restore <span>Local only</span></summary>
      <div className="backup-content">
        <p>Tender has no account or cloud copy. Download a backup occasionally so a browser reset or lost device does not erase your journal.</p>
        {entries.length > 0 && <p className={backupIsDue(lastBackupAt) ? 'backup-reminder due' : 'backup-reminder'}>{backupReminder(lastBackupAt)}</p>}
        <div className="backup-actions">
          <button type="button" disabled={entries.length === 0} onClick={exportBackup}>Download backup</button>
          <button type="button" className="secondary" onClick={() => fileInput.current?.click()}>Import backup</button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => importBackup(event.target.files?.[0])} />
        </div>
        <p className="backup-note">Importing merges records by their private ID. It does not delete entries already on this device.</p>
        {status && <p className="backup-status" role="status">{status}</p>}
      </div>
    </details>
  );
}

export function backupIsDue(lastBackupAt: string | null, now = new Date()) {
  if (!lastBackupAt) return true;
  const elapsed = now.getTime() - new Date(lastBackupAt).getTime();
  return !Number.isFinite(elapsed) || elapsed >= BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000;
}

export function backupReminder(lastBackupAt: string | null, now = new Date()) {
  if (!lastBackupAt) return 'No backup recorded on this device yet.';
  const date = new Date(lastBackupAt);
  if (Number.isNaN(date.getTime())) return 'Backup date unavailable. Consider downloading a new backup.';
  const formatted = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  return backupIsDue(lastBackupAt, now) ? `Last backup: ${formatted}. A fresh backup is recommended.` : `Last backup: ${formatted}.`;
}
