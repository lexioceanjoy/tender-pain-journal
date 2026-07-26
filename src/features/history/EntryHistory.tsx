import type { PainEntry } from '../../shared/data/painEntry';

type Props = {
  entries: PainEntry[];
  onSelect: (entry: PainEntry) => void;
};

export function EntryHistory({ entries, onSelect }: Props) {
  const list = (items: PainEntry[]) => items.map((entry) => (
    <button className="recent-entry" type="button" key={entry.id} onClick={() => onSelect(entry)}>
      <span className="recent-entry-summary">
        <strong>{entry.intensity}/10</strong>
        <span>{entry.regions.length} {entry.regions.length === 1 ? 'location' : 'locations'}</span>
      </span>
      <time dateTime={entry.occurredAt}>{formatEntryTime(entry.occurredAt)}</time>
    </button>
  ));

  return (
    <div className="recent-list">
      {list(entries.slice(0, 3))}
      {entries.length > 3 && <details className="all-history"><summary>View all {entries.length} check-ins</summary>{list(entries.slice(3))}</details>}
    </div>
  );
}

function formatEntryTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}
