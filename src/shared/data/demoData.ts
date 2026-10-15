import { createPainEntry, type PainEntry, type PainEntryInput } from './painEntry';

const DECISION_KEY = 'tender-demo-decision';
const SEEDED_IDS_KEY = 'tender-demo-entry-ids';

function isoDaysAgo(days: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function demoEntryInputs(): PainEntryInput[] {
  return [
    {
      regions: ['choir-b18'],
      intensity: 5,
      occurredAt: isoDaysAgo(13, 9),
      sensations: ['aching'],
      activities: ['long drive'],
      sleep: 'okay',
      note: 'Started after sitting through a long meeting.'
    },
    {
      regions: ['choir-b18', 'choir-b23'],
      intensity: 7,
      occurredAt: isoDaysAgo(11, 7),
      precisionAreas: ['tender-detail-si-left'],
      sensations: ['sharp', 'tight'],
      sleep: 'poor',
      stress: 'high',
      note: 'Woke up stiff, harder to get out of bed.'
    },
    {
      regions: ['choir-b23'],
      intensity: 4,
      occurredAt: isoDaysAgo(9, 14),
      sensations: ['tingling'],
      sleep: 'good',
      activities: ['short walk', 'stretching']
    },
    {
      regions: ['choir-f36'],
      intensity: 3,
      occurredAt: isoDaysAgo(6, 11),
      sensations: ['numb'],
      activities: ['standing a while']
    },
    {
      regions: ['choir-b18'],
      intensity: 6,
      occurredAt: isoDaysAgo(4, 8),
      sensations: ['aching', 'burning'],
      sleep: 'okay',
      medication: { name: 'Ibuprofen', dose: '200mg', perceivedEffect: 'helped' }
    },
    {
      regions: ['choir-b23', 'choir-b07'],
      intensity: 5,
      occurredAt: isoDaysAgo(2, 16),
      sensations: ['tight'],
      activities: ['desk work'],
      mood: 'low'
    },
    {
      regions: ['choir-b18'],
      intensity: 6,
      occurredAt: isoDaysAgo(1, 9),
      sensations: ['aching'],
      note: 'Similar pattern to last week — worse after sitting.'
    }
  ];
}

export function buildDemoEntries(): PainEntry[] {
  return demoEntryInputs().map(createPainEntry);
}

// Explicit decision record, not just "ids present": once a visitor clears
// demo data, it must never come back on its own — including after they
// delete all their own real entries, which would otherwise look just like
// a fresh, empty journal.
export function hasDemoDataDecisionBeenMade(): boolean {
  try {
    return localStorage.getItem(DECISION_KEY) !== null;
  } catch {
    // No working localStorage means there's no way to record "cleared"
    // later, so don't seed in the first place.
    return true;
  }
}

export function getSeededDemoIds(): string[] {
  try {
    const raw = localStorage.getItem(SEEDED_IDS_KEY);
    return raw ? JSON.parse(raw) as string[] : [];
  } catch {
    return [];
  }
}

export function recordDemoSeeded(ids: string[]) {
  try {
    localStorage.setItem(DECISION_KEY, 'seeded');
    localStorage.setItem(SEEDED_IDS_KEY, JSON.stringify(ids));
  } catch {
    // Best effort; worst case this prompts again next load.
  }
}

export function recordDemoCleared() {
  try {
    localStorage.setItem(DECISION_KEY, 'cleared');
    localStorage.removeItem(SEEDED_IDS_KEY);
  } catch {
    // Best effort.
  }
}
