import type { PainEntry } from '../../shared/data/painEntry';
import { EntryHistory } from './EntryHistory';

export function HistoryScreen({ entries, onSelect }: { entries: PainEntry[]; onSelect: (entry: PainEntry) => void }) {
  return (
    <section className="screen-card" aria-labelledby="history-title">
      <p className="eyebrow">History</p>
      <h2 id="history-title">Your check-ins</h2>
      {entries.length
        ? <><p className="screen-intro">Open any check-in to review or edit it.</p><EntryHistory entries={entries} onSelect={onSelect} /></>
        : <p className="empty-screen">No check-ins yet. A quick note today will start your private history.</p>}
    </section>
  );
}
