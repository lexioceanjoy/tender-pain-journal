import type { Dispatch, SetStateAction } from 'react';
import { findBodyRegion } from '../body-map/bodyRegions';
import {
  NO_MARKER_ACTIVITY,
  cycleOptions,
  interferenceAreaOptions,
  interferenceLabels,
  interferenceOptions,
  moodOptions,
  patternLabels,
  patternOptions,
  sensationOptions,
  sleepOptions,
  stressOptions,
  type ActivityEffect,
  type AreaPattern,
  type Interference,
  type InterferenceArea,
  type Sensation
} from '../../shared/data/painEntry';

export type ContextState = {
  sensations: Sensation[];
  activities: string[];
  sleep?: typeof sleepOptions[number];
  stress?: typeof stressOptions[number];
  mood?: typeof moodOptions[number];
  cycle?: typeof cycleOptions[number];
  medicationName: string;
  medicationDose: string;
  medicationEffect?: 'helped' | 'no-change' | 'not-sure';
  interference?: Interference;
  interferenceAreas: InterferenceArea[];
  activityEffects: Partial<Record<string, ActivityEffect>>;
  painWokeMe: boolean;
  /** Choices the person made (or that edit/repeat loaded). null = cleared, so no pre-fill comes back. */
  areaPatterns: Record<string, AreaPattern | null>;
  note: string;
};

export const emptyContext: ContextState = {
  sensations: [],
  activities: [],
  medicationName: '',
  medicationDose: '',
  interferenceAreas: [],
  activityEffects: {},
  painWokeMe: false,
  areaPatterns: {},
  note: ''
};


function showsInterferenceAreas(level?: Interference) {
  return level === 'a-lot' || level === 'unable';
}

const activityOptions = ['Long sitting', 'Walking', 'Workout', 'Lifting', 'Travel', 'Poor sleep'];

type Props = {
  value: ContextState;
  onChange: Dispatch<SetStateAction<ContextState>>;
  onOpenChange?: (open: boolean) => void;
  /** Selected CHOIR regions, for the steady / comes-and-goes rows. */
  regions?: string[];
  /** Per region, the most recent earlier pattern, shown as "from last time". */
  patternPrefill?: Record<string, AreaPattern>;
  /** datetime-local value; a backdated check-in asks about "that day". */
  occurredAt?: string;
};

export function OptionalContext({ value, onChange, onOpenChange, regions = [], patternPrefill = {}, occurredAt }: Props) {
  const isToday = !occurredAt || occurredAt.slice(0, 10) === todayLocal();

  function setInterference(level: Interference) {
    onChange((current) => {
      const next = current.interference === level ? undefined : level;
      return { ...current, interference: next, interferenceAreas: showsInterferenceAreas(next) ? current.interferenceAreas : [] };
    });
  }

  function toggleInterferenceArea(area: InterferenceArea) {
    onChange((current) => ({
      ...current,
      interferenceAreas: current.interferenceAreas.includes(area)
        ? current.interferenceAreas.filter((item) => item !== area)
        : [...current.interferenceAreas, area]
    }));
  }

  function setActivityEffect(activity: string, effect: ActivityEffect) {
    onChange((current) => {
      const activityEffects = { ...current.activityEffects };
      if (activityEffects[activity] === effect) delete activityEffects[activity];
      else activityEffects[activity] = effect;
      return { ...current, activityEffects };
    });
  }

  // Tapping either chip on a pre-filled row makes it the person's choice;
  // tapping their own pressed chip clears it.
  function setPattern(regionId: string, pattern: AreaPattern) {
    onChange((current) => {
      const chosen = current.areaPatterns[regionId];
      return { ...current, areaPatterns: { ...current.areaPatterns, [regionId]: chosen === pattern ? null : pattern } };
    });
  }

  function toggleSensation(option: Sensation) {
    onChange((current) => ({
      ...current,
      sensations: current.sensations.includes(option)
        ? current.sensations.filter((item) => item !== option)
        : [...current.sensations, option]
    }));
  }

  function toggleActivity(option: string) {
    onChange((current) => {
      const selected = current.activities.includes(option);
      const activityEffects = { ...current.activityEffects };
      if (selected) delete activityEffects[option];
      return {
        ...current,
        activities: selected ? current.activities.filter((item) => item !== option) : [...current.activities, option],
        activityEffects
      };
    });
  }

  return (
    <details className="context-panel" onToggle={(event) => onOpenChange?.(event.currentTarget.open)}>
      <summary>Add context <span>Optional</span></summary>

      <fieldset>
        <legend>Sensation</legend>
        <div className="chip-group">
          {sensationOptions.map((option) => (
            <button key={option} type="button" className={value.sensations.includes(option) ? 'chip selected' : 'chip'} aria-pressed={value.sensations.includes(option)} onClick={() => toggleSensation(option)}>
              {capitalize(option)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Activity or possible trigger</legend>
        <div className="chip-group">
          {activityOptions.map((option) => (
            <button key={option} type="button" className={value.activities.includes(option) ? 'chip selected' : 'chip'} aria-pressed={value.activities.includes(option)} onClick={() => toggleActivity(option)}>
              {option}
            </button>
          ))}
        </div>
        {value.activities.filter((activity) => activity !== NO_MARKER_ACTIVITY).map((activity) => (
          <div className="marker-row" key={activity} role="group" aria-label={`${activity}: your marker`}>
            <span>{activity}:</span>
            {(['worse', 'helped'] as const).map((effect) => (
              <button key={effect} type="button" className={value.activityEffects[activity] === effect ? 'chip small selected' : 'chip small'} aria-pressed={value.activityEffects[activity] === effect} aria-label={`${activity}: ${effect === 'worse' ? 'Made worse' : 'Helped'}`} onClick={() => setActivityEffect(activity, effect)}>
                {effect === 'worse' ? 'Made worse' : 'Helped'}
              </button>
            ))}
          </div>
        ))}
      </fieldset>

      <fieldset>
        <legend>Did pain get in the way {isToday ? 'today' : 'that day'}?</legend>
        <div className="chip-group">
          {interferenceOptions.map((level) => (
            <button key={level} type="button" className={value.interference === level ? 'chip selected' : 'chip'} aria-pressed={value.interference === level} onClick={() => setInterference(level)}>
              {interferenceLabels[level]}
            </button>
          ))}
        </div>
        {showsInterferenceAreas(value.interference) && (
          <div className="sub-question" role="group" aria-label="What did it get in the way of?">
            <p>What did it get in the way of?</p>
            <div className="chip-group">
              {interferenceAreaOptions.map((area) => (
                <button key={area} type="button" className={value.interferenceAreas.includes(area) ? 'chip selected' : 'chip'} aria-pressed={value.interferenceAreas.includes(area)} onClick={() => toggleInterferenceArea(area)}>
                  {capitalize(area)}
                </button>
              ))}
            </div>
          </div>
        )}
      </fieldset>

      {regions.length > 0 && (
        <fieldset>
          <legend>Steady or comes and goes?</legend>
          {regions.map((regionId) => {
            const chosen = value.areaPatterns[regionId];
            const prefilled = chosen === undefined ? patternPrefill[regionId] : undefined;
            const shown = chosen === undefined ? prefilled : chosen ?? undefined;
            const label = findBodyRegion(regionId)?.label ?? 'Selected area';
            return (
              <div className="marker-row" key={regionId} role="group" aria-label={`${label}: steady or comes and goes`}>
                <span>{label}:</span>
                {patternOptions.map((pattern) => (
                  <button key={pattern} type="button" className={shown === pattern ? 'chip small selected' : 'chip small'} aria-pressed={shown === pattern} aria-label={`${label}: ${patternLabels[pattern]}`} onClick={() => setPattern(regionId, pattern)}>
                    {patternLabels[pattern]}
                  </button>
                ))}
                {prefilled && <em className="prefill-tag">from last time</em>}
              </div>
            );
          })}
        </fieldset>
      )}

      <div className="compact-grid">
        <OptionSelect label="Sleep" value={value.sleep} options={sleepOptions} onChange={(sleep) => onChange((current) => ({ ...current, sleep }))} />
        <div className="toggle-cell">
          <button type="button" className={value.painWokeMe ? 'chip selected' : 'chip'} aria-pressed={value.painWokeMe} onClick={() => onChange((current) => ({ ...current, painWokeMe: !current.painWokeMe }))}>
            Pain woke me
          </button>
        </div>
        <OptionSelect label="Stress" value={value.stress} options={stressOptions} onChange={(stress) => onChange((current) => ({ ...current, stress }))} />
        <OptionSelect label="Mood" value={value.mood} options={moodOptions} onChange={(mood) => onChange((current) => ({ ...current, mood }))} />
        <OptionSelect label="Cycle" value={value.cycle} options={cycleOptions} onChange={(cycle) => onChange((current) => ({ ...current, cycle }))} />
      </div>

      <fieldset>
        <legend>Medication</legend>
        <div className="medication-grid">
          <label>Name<input value={value.medicationName} onChange={(event) => onChange((current) => ({ ...current, medicationName: event.target.value }))} placeholder="e.g. ibuprofen" /></label>
          <label>Dose <span>optional</span><input value={value.medicationDose} onChange={(event) => onChange((current) => ({ ...current, medicationDose: event.target.value }))} placeholder="e.g. 200 mg" /></label>
          <label>Did it help?
            <select value={value.medicationEffect ?? ''} onChange={(event) => onChange((current) => ({ ...current, medicationEffect: event.target.value ? event.target.value as ContextState['medicationEffect'] : undefined }))}>
              <option value="">Not recorded</option>
              <option value="helped">Helped</option>
              <option value="no-change">No change</option>
              <option value="not-sure">Not sure yet</option>
            </select>
          </label>
        </div>
      </fieldset>

      <label className="note-field">Anything else?
        <textarea value={value.note} maxLength={2000} rows={3} onChange={(event) => onChange((current) => ({ ...current, note: event.target.value }))} placeholder="What changed today?" />
      </label>
    </details>
  );
}

function OptionSelect<T extends readonly string[]>({ label, value, options, onChange }: { label: string; value?: T[number]; options: T; onChange: (value: T[number] | undefined) => void }) {
  return (
    <label>{label}
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value ? event.target.value as T[number] : undefined)}>
        <option value="">Not added</option>
        {options.map((option) => <option value={option} key={option}>{capitalize(option)}</option>)}
      </select>
    </label>
  );
}

function todayLocal() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace('-', ' ');
}
