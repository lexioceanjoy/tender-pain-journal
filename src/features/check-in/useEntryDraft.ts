import { useState } from 'react';
import type { AreaOverrides } from '../entries/AreaDetails';
import { emptyContext, type ContextState } from '../entries/OptionalContext';
import { repeatPainEntryInput, type PainEntry } from '../../shared/data/painEntry';

export type DraftMode = 'new' | 'repeat' | 'edit';

export type EntryDraft = {
  mode: DraftMode;
  regions: string[];
  intensity: number;
  intensityConfirmed: boolean;
  context: ContextState;
  areaOverrides: AreaOverrides;
  precisionAreas: string[];
  occurredAt: string;
  /** Add context was opened during this check-in: pre-filled patterns may be saved. */
  contextOpened: boolean;
  editingEntry?: PainEntry;
};

export function useEntryDraft() {
  const [draft, setDraft] = useState<EntryDraft>(() => emptyDraft());

  function startNew() {
    setDraft(emptyDraft());
  }

  function startRepeat(entry: PainEntry) {
    const input = repeatPainEntryInput(entry);
    setDraft({
      mode: 'repeat',
      regions: [...input.regions],
      intensity: input.intensity,
      intensityConfirmed: true,
      context: {
        ...emptyContext,
        sensations: [...(input.sensations ?? [])],
        areaPatterns: Object.fromEntries((input.areaPatterns ?? []).map(({ regionId, pattern }) => [regionId, pattern]))
      },
      areaOverrides: Object.fromEntries(
        (input.areaDetails ?? []).map(({ regionId, ...details }) => [regionId, { ...details }])
      ),
      precisionAreas: [...(input.precisionAreas ?? [])],
      occurredAt: toDateTimeLocal(input.occurredAt ?? new Date().toISOString()),
      contextOpened: false
    });
  }

  function startEdit(entry: PainEntry) {
    const medication = entry.context?.medications?.[0];
    setDraft({
      mode: 'edit',
      regions: [...entry.regions],
      intensity: entry.intensity,
      intensityConfirmed: true,
      context: {
        sensations: [...(entry.sensations ?? [])],
        activities: [...(entry.context?.activities ?? [])],
        sleep: entry.context?.sleep,
        stress: entry.context?.stress,
        mood: entry.context?.mood,
        cycle: entry.context?.cycle,
        medicationName: medication?.name ?? '',
        medicationDose: medication?.dose ?? '',
        medicationEffect: medication?.perceivedEffect,
        interference: entry.context?.interference,
        interferenceAreas: [...(entry.context?.interferenceAreas ?? [])],
        activityEffects: { ...(entry.context?.activityEffects ?? {}) },
        painWokeMe: entry.context?.painWokeMe === true,
        areaPatterns: Object.fromEntries((entry.areaPatterns ?? []).map(({ regionId, pattern }) => [regionId, pattern])),
        note: entry.note ?? ''
      },
      areaOverrides: Object.fromEntries(
        (entry.areaDetails ?? []).map(({ regionId, ...details }) => [regionId, { ...details }])
      ),
      precisionAreas: [...(entry.precisionAreas ?? [])],
      occurredAt: toDateTimeLocal(entry.occurredAt),
      contextOpened: false,
      editingEntry: entry
    });
  }

  return { draft, setDraft, startNew, startRepeat, startEdit };
}

function emptyDraft(): EntryDraft {
  return {
    mode: 'new',
    regions: [],
    intensity: 5,
    intensityConfirmed: false,
    context: { ...emptyContext },
    areaOverrides: {},
    precisionAreas: [],
    occurredAt: toDateTimeLocal(new Date().toISOString()),
    contextOpened: false
  };
}

export function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
