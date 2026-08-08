import type { Dispatch, SetStateAction } from 'react';
import {
  cycleOptions,
  moodOptions,
  sensationOptions,
  sleepOptions,
  stressOptions,
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
  note: string;
};

export const emptyContext: ContextState = {
  sensations: [],
  activities: [],
  medicationName: '',
  medicationDose: '',
  note: ''
};

const activityOptions = ['Long sitting', 'Walking', 'Workout', 'Lifting', 'Travel', 'Poor sleep'];

type Props = {
  value: ContextState;
  onChange: Dispatch<SetStateAction<ContextState>>;
  onOpenChange?: (open: boolean) => void;
};

export function OptionalContext({ value, onChange, onOpenChange }: Props) {
  function toggleSensation(option: Sensation) {
    onChange((current) => ({
      ...current,
      sensations: current.sensations.includes(option)
        ? current.sensations.filter((item) => item !== option)
        : [...current.sensations, option]
    }));
  }

  function toggleActivity(option: string) {
    onChange((current) => ({
      ...current,
      activities: current.activities.includes(option)
        ? current.activities.filter((item) => item !== option)
        : [...current.activities, option]
    }));
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
      </fieldset>

      <div className="compact-grid">
        <OptionSelect label="Sleep" value={value.sleep} options={sleepOptions} onChange={(sleep) => onChange((current) => ({ ...current, sleep }))} />
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

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace('-', ' ');
}
