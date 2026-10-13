import type { PainEntry } from '../../shared/data/painEntry';
import { BackupPanel } from '../backup/BackupPanel';
import { ExportPanel } from '../export/ExportPanel';

type Props = {
  entries: PainEntry[];
  onImport: (entries: PainEntry[]) => Promise<void>;
  onSafetyOpen: () => void;
};

export function MoreScreen({ entries, onImport, onSafetyOpen }: Props) {
  return (
    <section className="screen-card" aria-labelledby="more-title">
      <p className="eyebrow">More</p>
      <h2 id="more-title">Privacy and support</h2>
      <div className="more-section">
        <h3>Your records stay with you</h3>
        <p>Tender keeps check-ins in this browser. Nothing is uploaded automatically.</p>
      </div>
      <button className="safety-link in-card" type="button" onClick={onSafetyOpen}>
        <span>Urgent symptoms? Get help now</span><span aria-hidden="true">›</span>
      </button>
      <BackupPanel entries={entries} onImport={onImport} />
      <ExportPanel entries={entries} />
      <div className="more-section attribution-note">
        <h3>About the map</h3>
        <p>Tender uses the CHOIR Body Map for patient-reported surface location. It does not identify a diagnosis or underlying structure.</p>
      </div>
    </section>
  );
}
