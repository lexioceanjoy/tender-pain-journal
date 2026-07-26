import { describe, expect, it } from 'vitest';
import { backupIsDue, backupReminder } from './BackupPanel';

describe('backup reminder', () => {
  const now = new Date('2026-07-26T12:00:00.000Z');

  it('reminds someone who has not backed up yet', () => {
    expect(backupIsDue(null, now)).toBe(true);
    expect(backupReminder(null, now)).toContain('No backup recorded');
  });

  it('recommends a fresh backup after fourteen days', () => {
    const lastBackup = '2026-07-01T12:00:00.000Z';
    expect(backupIsDue(lastBackup, now)).toBe(true);
    expect(backupReminder(lastBackup, now)).toContain('fresh backup is recommended');
  });

  it('shows a recent backup without warning', () => {
    const lastBackup = '2026-07-24T12:00:00.000Z';
    expect(backupIsDue(lastBackup, now)).toBe(false);
    expect(backupReminder(lastBackup, now)).not.toContain('recommended');
  });
});
