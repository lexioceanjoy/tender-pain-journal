import { useEffect, useState } from 'react';
import { BodyMap } from '../features/body-map/BodyMap';
import { canUsePrecisionArea } from '../features/body-map/precisionAreas';
import { BackupPanel } from '../features/backup/BackupPanel';
import { AreaDetails, type AreaOverrides } from '../features/entries/AreaDetails';
import { emptyContext, OptionalContext, type ContextState } from '../features/entries/OptionalContext';
import { EntryDetailDialog } from '../features/history/EntryDetailDialog';
import { EntryHistory } from '../features/history/EntryHistory';
import { InsightsPanel } from '../features/insights/InsightsPanel';
import { deletePainEntry, listPainEntries, mergePainEntries, savePainEntry } from '../shared/data/database';
import { createPainEntry, updatePainEntry, type PainEntry, type PainEntryInput } from '../shared/data/painEntry';

export function App() {
  const [regions, setRegions] = useState<string[]>([]);
  const [intensity, setIntensity] = useState(5);
  const [context, setContext] = useState<ContextState>(emptyContext);
  const [areaOverrides, setAreaOverrides] = useState<AreaOverrides>({});
  const [precisionAreas, setPrecisionAreas] = useState<string[]>([]);
  const [entries, setEntries] = useState<PainEntry[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [occurredAt, setOccurredAt] = useState(toDateTimeLocal(new Date().toISOString()));
  const [editingEntry, setEditingEntry] = useState<PainEntry>();
  const [selectedEntry, setSelectedEntry] = useState<PainEntry>();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    listPainEntries().then(setEntries).catch(() => setSaveState('error'));
  }, []);

  async function handleSave() {
    if (regions.length === 0) return;
    setSaveState('saving');
    try {
      const input: PainEntryInput = {
        regions,
        intensity,
        occurredAt: new Date(occurredAt).toISOString(),
        sensations: context.sensations,
        activities: context.activities,
        sleep: context.sleep,
        stress: context.stress,
        mood: context.mood,
        cycle: context.cycle,
        medication: context.medicationName ? {
          name: context.medicationName,
          dose: context.medicationDose,
          perceivedEffect: context.medicationEffect
        } : undefined,
        areaDetails: Object.entries(areaOverrides)
          .filter(([regionId]) => regions.includes(regionId))
          .map(([regionId, override]) => ({ regionId, ...override })),
        precisionAreas,
        note: context.note
      };
      const entry = editingEntry ? updatePainEntry(editingEntry, input) : createPainEntry(input);
      await savePainEntry(entry);
      setEntries((current) => [...current.filter((item) => item.id !== entry.id), entry].sort(
        (a, b) => b.occurredAt.localeCompare(a.occurredAt)
      ));
      resetForm();
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }

  function resetForm() {
    setRegions([]);
    setIntensity(5);
    setContext({ ...emptyContext });
    setAreaOverrides({});
    setPrecisionAreas([]);
    setOccurredAt(toDateTimeLocal(new Date().toISOString()));
    setEditingEntry(undefined);
  }

  function editEntry(entry: PainEntry) {
    const medication = entry.context?.medications?.[0];
    setRegions(entry.regions);
    setIntensity(entry.intensity);
    setContext({
      sensations: entry.sensations ?? [],
      activities: entry.context?.activities ?? [],
      sleep: entry.context?.sleep,
      stress: entry.context?.stress,
      mood: entry.context?.mood,
      cycle: entry.context?.cycle,
      medicationName: medication?.name ?? '',
      medicationDose: medication?.dose ?? '',
      medicationEffect: medication?.perceivedEffect,
      note: entry.note ?? ''
    });
    setAreaOverrides(Object.fromEntries((entry.areaDetails ?? []).map(({ regionId, ...details }) => [regionId, details])));
    setPrecisionAreas(entry.precisionAreas ?? []);
    setOccurredAt(toDateTimeLocal(entry.occurredAt));
    setEditingEntry(entry);
    setSelectedEntry(undefined);
    setConfirmingDelete(false);
    setSaveState('idle');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function removeSelectedEntry() {
    if (!selectedEntry) return;
    try {
      await deletePainEntry(selectedEntry.id);
      setEntries((current) => current.filter((entry) => entry.id !== selectedEntry.id));
      if (editingEntry?.id === selectedEntry.id) resetForm();
      setSelectedEntry(undefined);
      setConfirmingDelete(false);
    } catch {
      setSaveState('error');
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Private pain journal</p>
          <h1>Tender</h1>
        </div>
      </header>

      <section className="check-in-card" aria-labelledby="check-in-title">
        <div className="section-header">
          <div>
            <p className="eyebrow">{editingEntry ? 'Editing check-in' : 'Today’s check-in'}</p>
            <h2 id="check-in-title">What’s feeling tender?</h2>
          </div>
          {!editingEntry && <time dateTime={new Date().toISOString()}>{formatToday()}</time>}
        </div>

        {editingEntry && (
          <div className="editing-banner">
            <span>Changes will replace this saved check-in.</span>
            <button type="button" onClick={() => { resetForm(); setSaveState('idle'); }}>Cancel editing</button>
          </div>
        )}

        <label className="occurred-at-field" htmlFor="occurred-at">
          When did this happen?
          <input id="occurred-at" type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
        </label>

        <BodyMap
          selectedRegions={regions}
          selectedPrecisionAreas={precisionAreas}
          onPrecisionSelectionChange={setPrecisionAreas}
          onSelectionChange={(nextRegions) => {
            setRegions(nextRegions);
            setPrecisionAreas((current) => current.filter((id) => canUsePrecisionArea(id, nextRegions)));
            setAreaOverrides((current) => Object.fromEntries(
              Object.entries(current).filter(([regionId]) => nextRegions.includes(regionId))
            ));
          }}
        />

        <label className="intensity-label" htmlFor="intensity">
          Pain intensity <strong>{intensity}</strong><span>/10</span>
        </label>
        <input
          id="intensity"
          className="intensity-slider"
          type="range"
          min="0"
          max="10"
          value={intensity}
          aria-valuetext={`${intensity} out of 10`}
          onChange={(event) => setIntensity(Number(event.target.value))}
        />
        <div className="slider-labels" aria-hidden="true"><span>None</span><span>Moderate</span><span>Worst</span></div>

        <OptionalContext value={context} onChange={setContext} />
        <AreaDetails
          selectedRegions={regions}
          defaultIntensity={intensity}
          defaultSensations={context.sensations}
          value={areaOverrides}
          onChange={setAreaOverrides}
        />

        {saveState === 'saved' && <p className="save-feedback" role="status">Check-in saved privately on this device.</p>}
        {saveState === 'error' && <p className="save-error" role="alert">Tender could not access private storage on this device.</p>}
        <button className="save-button" type="button" disabled={regions.length === 0 || !occurredAt || saveState === 'saving'} onClick={handleSave}>
          {regions.length === 0 ? 'Select a location to continue' : saveState === 'saving' ? 'Saving…' : editingEntry ? 'Save changes' : 'Save check-in'}
        </button>
      </section>

      <button className="safety-link" type="button" onClick={() => setSafetyOpen(true)}>
        <span>Urgent symptoms? Get help now</span><span aria-hidden="true">›</span>
      </button>

      {safetyOpen && (
        <div className="safety-backdrop">
          <section className="safety-dialog" role="dialog" aria-modal="true" aria-labelledby="safety-title">
            <button className="dialog-close" type="button" aria-label="Close urgent symptoms message" onClick={() => setSafetyOpen(false)}>×</button>
            <p className="eyebrow">Safety information</p>
            <h2 id="safety-title">When to get urgent help</h2>
            <p>This app cannot assess urgent symptoms. Seek urgent medical care for new, severe, rapidly worsening, or worrying symptoms—especially new changes in bladder or bowel control, numbness around the groin or buttocks, or worsening weakness or difficulty walking.</p>
            <p><strong>This is not a complete list.</strong></p>
            <button className="dialog-done" type="button" onClick={() => setSafetyOpen(false)}>Got it</button>
          </section>
        </div>
      )}

      <section className="next-card" aria-labelledby="next-title">
        <p className="eyebrow">Recent check-ins</p>
        <h2 id="next-title">{entries.length ? `${entries.length} saved on this device` : 'A clearer story over time.'}</h2>
        {entries.length === 0
          ? <p>Your saved check-ins, optional context, and private summaries will live here.</p>
          : <EntryHistory entries={entries} onSelect={(entry) => { setSelectedEntry(entry); setConfirmingDelete(false); }} />}
      </section>

      <InsightsPanel entries={entries} />
      <BackupPanel entries={entries} onImport={async (imported) => setEntries(await mergePainEntries(imported))} />

      {selectedEntry && (
        <EntryDetailDialog
          entry={selectedEntry}
          confirmingDelete={confirmingDelete}
          onConfirmingDeleteChange={setConfirmingDelete}
          onClose={() => { setSelectedEntry(undefined); setConfirmingDelete(false); }}
          onEdit={() => editEntry(selectedEntry)}
          onDelete={removeSelectedEntry}
        />
      )}
    </main>
  );
}

function formatToday() {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date());
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
