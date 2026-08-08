import type { PainEntry } from '../../shared/data/painEntry';
import { EntryHistory } from '../history/EntryHistory';

type Props = {
  entries: PainEntry[];
  savedMessage?: string;
  onNew: () => void;
  onRepeat: (entry: PainEntry) => void;
  onSelectEntry: (entry: PainEntry) => void;
};

export function TodayScreen({ entries, savedMessage, onNew, onRepeat, onSelectEntry }: Props) {
  const latest = entries[0];
  return (
    <>
      <section className="today-hero" aria-labelledby="today-title">
        <p className="eyebrow">Today</p>
        <h2 id="today-title">A quick note while it’s fresh.</h2>
        <p>Mark where it hurts, choose an intensity, and save. Add more only when it feels useful.</p>
        {savedMessage && <p className="save-feedback" role="status">{savedMessage}</p>}
        <div className="today-actions">
          <button className="primary-action" type="button" onClick={onNew}>New check-in</button>
          {latest && <button className="repeat-action" type="button" onClick={() => onRepeat(latest)}>Repeat last</button>}
        </div>
        <p className="time-promise">A basic check-in is designed to take under 30 seconds.</p>
      </section>

      <section className="next-card today-latest" aria-labelledby="latest-title">
        <p className="eyebrow">Latest</p>
        <h2 id="latest-title">{latest ? 'Your most recent check-in' : 'Your first small check-in is enough.'}</h2>
        {latest
          ? <EntryHistory entries={[latest]} onSelect={onSelectEntry} />
          : <p>Tender will keep your check-ins privately on this device.</p>}
      </section>
    </>
  );
}
