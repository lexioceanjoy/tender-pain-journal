import { z } from 'zod';
import { painEntrySchema, type PainEntry } from '../../shared/data/painEntry';

const backupEnvelopeSchema = z.object({
  app: z.literal('Tender'),
  // 1 or 2: an older app rejects a v2 backup visibly instead of silently dropping new fields.
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.string().datetime({ offset: true }),
  entries: z.array(painEntrySchema)
});

export function createBackup(entries: PainEntry[]) {
  return JSON.stringify({
    app: 'Tender',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    entries
  }, null, 2);
}

export function parseBackup(value: string) {
  return backupEnvelopeSchema.parse(JSON.parse(value)).entries;
}
