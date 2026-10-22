import { findBodyRegion } from '../body-map/bodyRegions';
import { findPrecisionArea } from '../body-map/precisionAreas';
import { activityEffectLabels, getAreaDetails, interferenceLabels, patternLabels, type PainEntry } from '../../shared/data/painEntry';

type Props = {
  entry: PainEntry;
  confirmingDelete: boolean;
  onConfirmingDeleteChange: (confirming: boolean) => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function EntryDetailDialog({
  entry,
  confirmingDelete,
  onConfirmingDeleteChange,
  onClose,
  onEdit,
  onDelete
}: Props) {
  const medication = entry.context?.medications?.[0];

  return (
    <div className="entry-backdrop">
      <section className="entry-dialog" role="dialog" aria-modal="true" aria-labelledby="entry-detail-title">
        <button className="dialog-close" type="button" aria-label="Close check-in details" onClick={onClose}>×</button>
        <p className="eyebrow">Saved check-in</p>
        <h2 id="entry-detail-title">{formatEntryDate(entry.occurredAt)}</h2>

        <div className="entry-overall"><strong>{entry.intensity}/10</strong><span>overall intensity</span></div>

        <section className="entry-detail-section">
          <h3>Locations</h3>
          <ul className="entry-area-list">
            {entry.regions.map((regionId) => {
              const details = getAreaDetails(entry, regionId);
              return (
                <li key={regionId}>
                  <span>{findBodyRegion(regionId)?.label ?? 'Saved body area'}</span>
                  <span>{details.intensity}/10{details.sensations.length ? ` · ${details.sensations.join(', ')}` : ''}</span>
                </li>
              );
            })}
          </ul>
          {entry.precisionAreas?.length ? (
            <div className="entry-refined">
              <strong>More precise spots</strong>
              <div>{entry.precisionAreas.map((id) => <span key={id}>{findPrecisionArea(id)?.label ?? 'Saved refined area'}</span>)}</div>
            </div>
          ) : null}
        </section>

        <DetailGroup label="Overall sensations" value={entry.sensations?.join(', ')} />
        <DetailGroup label="Activity or possible trigger" value={entry.context?.activities?.map((activity) => {
          const effect = entry.context?.activityEffects?.[activity];
          return effect ? `${activity} (you marked: ${activityEffectLabels[effect]})` : activity;
        }).join(', ')} />
        <DetailGroup label="Got in the way" value={entry.context?.interference && [
          interferenceLabels[entry.context.interference],
          entry.context.interferenceAreas?.join(', ')
        ].filter(Boolean).join(' — ')} />
        <DetailGroup label="Steady or comes and goes" value={entry.areaPatterns?.map((item) => `${findBodyRegion(item.regionId)?.label ?? 'Saved body area'}: ${patternLabels[item.pattern].toLowerCase()}`).join('; ')} />
        <div className="entry-context-grid">
          <DetailGroup label="Sleep" value={[entry.context?.sleep, entry.context?.painWokeMe ? 'pain woke me' : undefined].filter(Boolean).join('; ')} />
          <DetailGroup label="Stress" value={entry.context?.stress} />
          <DetailGroup label="Mood" value={entry.context?.mood} />
          <DetailGroup label="Cycle" value={entry.context?.cycle} />
        </div>
        {medication && <DetailGroup label="Medication" value={[medication.name, medication.dose, medication.perceivedEffect?.replace('-', ' ')].filter(Boolean).join(' · ')} />}
        <DetailGroup label="Note" value={entry.note} />

        {confirmingDelete ? (
          <div className="delete-confirmation" role="alert">
            <p>Delete this check-in permanently? It cannot be recovered unless it exists in a backup.</p>
            <div>
              <button type="button" className="secondary-action" onClick={() => onConfirmingDeleteChange(false)}>Cancel</button>
              <button type="button" className="delete-action" onClick={onDelete}>Delete permanently</button>
            </div>
          </div>
        ) : (
          <div className="entry-dialog-actions">
            <button type="button" className="delete-link" onClick={() => onConfirmingDeleteChange(true)}>Delete</button>
            <button type="button" className="edit-action" onClick={onEdit}>Edit check-in</button>
          </div>
        )}
      </section>
    </div>
  );
}

function DetailGroup({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return <div className="entry-detail-group"><strong>{label}</strong><p>{value}</p></div>;
}

function formatEntryDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}
