import { z } from 'zod';
import { painEntrySchema, type PainEntry } from '../../shared/data/painEntry';

const backupEnvelopeSchema = z.object({
  app: z.literal('Tender'),
  schemaVersion: z.literal(1),
  exportedAt: z.string().datetime({ offset: true }),
  entries: z.array(painEntrySchema)
});

export function createBackup(entries: PainEntry[]) {
  return JSON.stringify({
    app: 'Tender',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    entries
  }, null, 2);
}

export function parseBackup(value: string) {
  return backupEnvelopeSchema.parse(JSON.parse(value)).entries;
}
