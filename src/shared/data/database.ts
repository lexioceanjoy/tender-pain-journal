import Dexie, { type EntityTable } from 'dexie';
import type { PainEntry } from './painEntry';

class TenderDatabase extends Dexie {
  painEntries!: EntityTable<PainEntry, 'id'>;

  constructor() {
    super('tender-journal');
    this.version(1).stores({
      painEntries: 'id, occurredAt, createdAt'
    });
  }
}

const database = new TenderDatabase();

export async function savePainEntry(entry: PainEntry) {
  await database.painEntries.put(entry);
}

export async function listPainEntries() {
  return database.painEntries.orderBy('occurredAt').reverse().toArray();
}

export async function mergePainEntries(entries: PainEntry[]) {
  await database.painEntries.bulkPut(entries);
  return listPainEntries();
}

export async function deletePainEntry(id: string) {
  await database.painEntries.delete(id);
}
