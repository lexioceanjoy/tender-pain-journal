import { useEffect, useState } from 'react';
import { CheckInScreen } from '../features/check-in/CheckInScreen';
import { useEntryDraft } from '../features/check-in/useEntryDraft';
import { HistoryScreen } from '../features/history/HistoryScreen';
import { EntryDetailDialog } from '../features/history/EntryDetailDialog';
import { InsightsPanel } from '../features/insights/InsightsPanel';
import { MoreScreen } from '../features/settings/MoreScreen';
import { TodayScreen } from '../features/today/TodayScreen';
import { deletePainEntry, listPainEntries, mergePainEntries, savePainEntry } from '../shared/data/database';
import { createPainEntry, updatePainEntry, type PainEntry, type PainEntryInput } from '../shared/data/painEntry';
import { requestPersistentStorageOnce } from '../shared/storage/persistentStorage';
import { navigateTo, routeFromHash, type AppRoute } from './routes';

export function App() {
  const [route, setRoute] = useState<AppRoute>(() => routeFromHash());
  const [entries, setEntries] = useState<PainEntry[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedMessage, setSavedMessage] = useState<string>();
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<PainEntry>();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { draft, setDraft, startNew, startRepeat, startEdit } = useEntryDraft();

  useEffect(() => {
    listPainEntries().then(setEntries).catch(() => setSaveState('error'));
  }, []);

  useEffect(() => {
    const updateRoute = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [route]);

  function goTo(next: AppRoute) {
    navigateTo(next);
    setRoute(next);
  }

  function beginNew() {
    startNew();
    setSaveState('idle');
    setSavedMessage(undefined);
    goTo('check-in');
  }

  function beginRepeat(entry: PainEntry) {
    startRepeat(entry);
    setSaveState('idle');
    setSavedMessage(undefined);
    goTo('check-in');
  }

  function cancelDraft() {
    const destination = draft.mode === 'edit' ? 'history' : 'today';
    startNew();
    setSaveState('idle');
    goTo(destination);
  }

  async function handleSave() {
    if (!draft.regions.length || !draft.intensityConfirmed || !draft.occurredAt) return;
    setSaveState('saving');
    try {
      const input: PainEntryInput = {
        regions: draft.regions,
        intensity: draft.intensity,
        occurredAt: new Date(draft.occurredAt).toISOString(),
        sensations: draft.context.sensations,
        activities: draft.context.activities,
        sleep: draft.context.sleep,
        stress: draft.context.stress,
        mood: draft.context.mood,
        cycle: draft.context.cycle,
        medication: draft.context.medicationName ? {
          name: draft.context.medicationName,
          dose: draft.context.medicationDose,
          perceivedEffect: draft.context.medicationEffect
        } : undefined,
        areaDetails: Object.entries(draft.areaOverrides)
          .filter(([regionId]) => draft.regions.includes(regionId))
          .map(([regionId, override]) => ({ regionId, ...override })),
        precisionAreas: draft.precisionAreas,
        note: draft.context.note
      };
      const entry = draft.mode === 'edit' && draft.editingEntry
        ? updatePainEntry(draft.editingEntry, input)
        : createPainEntry(input);
      await savePainEntry(entry);
      setEntries((current) => [...current.filter((item) => item.id !== entry.id), entry]
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)));
      // Only ever actually asks the browser once (see
      // requestPersistentStorageOnce) — safe to call after every save.
      // Deliberately not on mount/page load: the first ask should follow
      // a real save, not just opening the app.
      void requestPersistentStorageOnce();
      const wasEditing = draft.mode === 'edit';
      startNew();
      setSaveState('saved');
      setSavedMessage(wasEditing
        ? 'Changes saved privately on this device.'
        : 'Check-in saved privately on this device.');
      goTo(wasEditing ? 'history' : 'today');
    } catch {
      setSaveState('error');
    }
  }

  function editEntry(entry: PainEntry) {
    startEdit(entry);
    setSelectedEntry(undefined);
    setConfirmingDelete(false);
    setSaveState('idle');
    goTo('check-in');
  }

  async function removeSelectedEntry() {
    if (!selectedEntry) return;
    try {
      await deletePainEntry(selectedEntry.id);
      setEntries((current) => current.filter((entry) => entry.id !== selectedEntry.id));
      setSelectedEntry(undefined);
      setConfirmingDelete(false);
    } catch {
      setSaveState('error');
    }
  }

  function selectEntry(entry: PainEntry) {
    setSelectedEntry(entry);
    setConfirmingDelete(false);
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <button className="brand-button" type="button" onClick={() => goTo('today')} aria-label="Tender home">
          <span className="eyebrow">Private pain journal</span>
          <h1>Tender</h1>
        </button>
        <button className="header-safety" type="button" onClick={() => setSafetyOpen(true)}>Urgent help</button>
      </header>

      <div className="screen-container">
        {route === 'today' && (
          <TodayScreen
            entries={entries}
            savedMessage={savedMessage}
            onNew={beginNew}
            onRepeat={beginRepeat}
            onSelectEntry={selectEntry}
          />
        )}
        {route === 'check-in' && (
          <CheckInScreen
            draft={draft}
            setDraft={setDraft}
            saveState={saveState}
            onCancel={cancelDraft}
            onSave={handleSave}
          />
        )}
        {route === 'history' && <HistoryScreen entries={entries} onSelect={selectEntry} />}
        {route === 'insights' && <InsightsPanel entries={entries} />}
        {route === 'more' && (
          <MoreScreen
            entries={entries}
            onSafetyOpen={() => setSafetyOpen(true)}
            onImport={async (imported) => setEntries(await mergePainEntries(imported))}
          />
        )}
      </div>

      <nav className="bottom-nav" aria-label="Primary navigation">
        <NavButton label="Today" route="today" current={route === 'check-in' ? 'today' : route} onNavigate={goTo} />
        <NavButton label="History" route="history" current={route} onNavigate={goTo} />
        <NavButton label="Insights" route="insights" current={route} onNavigate={goTo} />
        <NavButton label="More" route="more" current={route} onNavigate={goTo} />
      </nav>

      {safetyOpen && (
        <div className="safety-backdrop">
          <section className="safety-dialog" role="dialog" aria-modal="true" aria-labelledby="safety-title">
            <button className="dialog-close" type="button" aria-label="Close urgent symptoms message" onClick={() => setSafetyOpen(false)}>×</button>
            <p className="eyebrow">Safety information</p>
            <h2 id="safety-title">When to get urgent help</h2>
            <p>This app cannot assess urgent symptoms. Seek urgent medical care for new, severe, rapidly worsening, or worrying symptoms—especially new changes in bladder or bowel control, numbness around the groin or buttocks, or worsening weakness or difficulty walking. These examples are not a complete list.</p>
            <button className="dialog-done" type="button" onClick={() => setSafetyOpen(false)}>Got it</button>
          </section>
        </div>
      )}

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

function NavButton({
  label,
  route,
  current,
  onNavigate
}: {
  label: string;
  route: Exclude<AppRoute, 'check-in'>;
  current: AppRoute;
  onNavigate: (route: AppRoute) => void;
}) {
  const selected = current === route;
  return (
    <button type="button" className={selected ? 'selected' : ''} aria-current={selected ? 'page' : undefined} onClick={() => onNavigate(route)}>
      <NavIcon route={route} />
      <span>{label}</span>
    </button>
  );
}

function NavIcon({ route }: { route: Exclude<AppRoute, 'check-in'> }) {
  if (route === 'today') return <span aria-hidden="true">●</span>;
  if (route === 'history') return <span aria-hidden="true">◷</span>;
  if (route === 'insights') return <span aria-hidden="true">⌁</span>;
  return <span aria-hidden="true">•••</span>;
}
