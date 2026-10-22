import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { BodyMap } from '../body-map/BodyMap';
import { canUsePrecisionArea } from '../body-map/precisionAreas';
import { AreaDetails } from '../entries/AreaDetails';
import { OptionalContext } from '../entries/OptionalContext';
import type { PainEntry } from '../../shared/data/painEntry';
import { patternPrefill } from './patternPrefill';
import type { EntryDraft } from './useEntryDraft';

/** Pre-fill only for new and repeated check-ins; an edit shows what that entry saved. */
export function draftPatternPrefill(draft: EntryDraft, entries: PainEntry[]) {
  if (draft.mode === 'edit' || !draft.occurredAt) return {};
  return patternPrefill(entries, draft.regions, new Date(draft.occurredAt).toISOString());
}

type Props = {
  draft: EntryDraft;
  setDraft: Dispatch<SetStateAction<EntryDraft>>;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  entries?: PainEntry[];
  onCancel: () => void;
  onSave: () => void;
};

export function CheckInScreen({ draft, setDraft, saveState, entries = [], onCancel, onSave }: Props) {
  const prefill = useMemo(() => draftPatternPrefill(draft, entries), [draft, entries]);
  const coreSaveRef = useRef<HTMLButtonElement>(null);
  const [coreSaveVisible, setCoreSaveVisible] = useState(true);
  const [optionalSections, setOptionalSections] = useState({ context: false, areas: false });
  const canSave = draft.regions.length > 0
    && draft.intensityConfirmed
    && Boolean(draft.occurredAt)
    && saveState !== 'saving';
  const showStickySave = (optionalSections.context || optionalSections.areas) && !coreSaveVisible;

  useEffect(() => {
    const button = coreSaveRef.current;
    if (!button || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setCoreSaveVisible(entry.isIntersecting), {
      threshold: 0.15
    });
    observer.observe(button);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (draft.regions.length < 2) {
      setOptionalSections((current) => current.areas ? { ...current, areas: false } : current);
    }
  }, [draft.regions.length]);

  function saveLabel() {
    if (draft.regions.length === 0) return 'Select a location to continue';
    if (!draft.intensityConfirmed) return 'Choose an intensity to continue';
    if (saveState === 'saving') return 'Saving…';
    return draft.mode === 'edit' ? 'Save changes' : 'Save check-in';
  }

  return (
    <section className={`check-in-card check-in-screen${showStickySave ? ' has-sticky-save' : ''}`} aria-labelledby="check-in-title">
      <div className="check-in-topline">
        <button className="back-link" type="button" onClick={onCancel}>← {draft.mode === 'edit' ? 'History' : 'Today'}</button>
        <span>{draft.mode === 'edit' ? 'Editing' : draft.mode === 'repeat' ? 'Repeating last' : 'New check-in'}</span>
      </div>

      <div className="section-header">
        <div>
          <p className="eyebrow">{draft.mode === 'edit' ? 'Edit saved check-in' : 'Quick check-in'}</p>
          <h2 id="check-in-title">What’s feeling tender?</h2>
        </div>
      </div>

      {draft.mode !== 'new' && (
        <div className="editing-banner">
          <span>{draft.mode === 'edit'
            ? 'Changes will replace this saved check-in.'
            : 'A new check-in using your last pain locations and settings.'}</span>
          <button type="button" onClick={onCancel}>Cancel</button>
        </div>
      )}

      <label className="occurred-at-field" htmlFor="occurred-at">
        When did this happen?
        <input
          id="occurred-at"
          type="datetime-local"
          value={draft.occurredAt}
          onChange={(event) => setDraft((current) => ({ ...current, occurredAt: event.target.value }))}
        />
      </label>

      <BodyMap
        selectedRegions={draft.regions}
        selectedPrecisionAreas={draft.precisionAreas}
        onPrecisionSelectionChange={(precisionAreas) => setDraft((current) => ({ ...current, precisionAreas }))}
        onSelectionChange={(regions) => setDraft((current) => ({
          ...current,
          regions,
          precisionAreas: current.precisionAreas.filter((id) => canUsePrecisionArea(id, regions)),
          areaOverrides: Object.fromEntries(
            Object.entries(current.areaOverrides).filter(([regionId]) => regions.includes(regionId))
          )
        }))}
      />

      <div className={`intensity-control ${draft.intensityConfirmed ? '' : 'unconfirmed'}`}>
        <label className="intensity-label" htmlFor="intensity">
          Pain intensity
          <strong>{draft.intensityConfirmed ? draft.intensity : 'Choose'}</strong>
          {draft.intensityConfirmed && <span>/10</span>}
        </label>
        <input
          id="intensity"
          className="intensity-slider"
          type="range"
          min="0"
          max="10"
          value={draft.intensity}
          aria-label="Pain intensity"
          aria-valuetext={draft.intensityConfirmed ? `${draft.intensity} out of 10` : 'Not selected'}
          onPointerDown={() => setDraft((current) => ({ ...current, intensityConfirmed: true }))}
          onKeyDown={(event) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
              setDraft((current) => ({ ...current, intensityConfirmed: true }));
            }
          }}
          onChange={(event) => setDraft((current) => ({
            ...current,
            intensity: Number(event.target.value),
            intensityConfirmed: true
          }))}
        />
        <div className="slider-labels" aria-hidden="true"><span>None</span><span>Moderate</span><span>Worst</span></div>
        {!draft.intensityConfirmed && <p className="field-hint">Touch the scale to confirm today’s intensity.</p>}
      </div>

      {saveState === 'error' && <p className="save-error" role="alert">Tender could not access private storage on this device.</p>}
      <button ref={coreSaveRef} className="save-button core-save-button" type="button" disabled={!canSave} onClick={onSave}>
        {saveLabel()}
      </button>
      <p className="quick-save-note">That’s enough for a useful check-in. Details below are optional.</p>

      <div className="optional-enrichment" aria-label="Optional check-in details">
        <OptionalContext
          value={draft.context}
          regions={draft.regions}
          patternPrefill={prefill}
          occurredAt={draft.occurredAt}
          onOpenChange={(context) => {
            setOptionalSections((current) => ({ ...current, context }));
            if (context) setDraft((current) => current.contextOpened ? current : { ...current, contextOpened: true });
          }}
          onChange={(update) => setDraft((current) => ({
            ...current,
            context: typeof update === 'function' ? update(current.context) : update
          }))}
        />
        <AreaDetails
          selectedRegions={draft.regions}
          defaultIntensity={draft.intensity}
          defaultSensations={draft.context.sensations}
          value={draft.areaOverrides}
          onOpenChange={(areas) => setOptionalSections((current) => ({ ...current, areas }))}
          onChange={(areaOverrides) => setDraft((current) => ({ ...current, areaOverrides }))}
        />
      </div>

      {showStickySave && (
        <div className="sticky-save-bar" role="region" aria-label="Save optional details">
          <span>{canSave ? 'Optional details added' : saveLabel()}</span>
          <button type="button" disabled={!canSave} onClick={onSave}>
            {saveState === 'saving' ? 'Saving…' : draft.mode === 'edit' ? 'Save changes' : 'Save now'}
          </button>
        </div>
      )}
    </section>
  );
}
