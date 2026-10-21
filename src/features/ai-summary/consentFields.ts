import type { AiSummaryRequest } from './aiSummarySchema';
import type { NarrativeFindings } from './narrativeFindings';

type AiRequestEntry = AiSummaryRequest['entries'][number];
type AiRequestMedication = NonNullable<AiRequestEntry['medications']>[number];

// The consent copy is built from these maps, one phrase per field. There
// are two hops (docs/plans/narrative-v2.md): the browser sends the request
// below to Tender's server, and the server sends the AI provider only the
// computed findings. `satisfies` makes a missing or extra key a type error;
// consentFields.test.ts checks the same against the runtime schema, a real
// request, and real findings, so the copy can't drift from either payload.
export const REQUEST_FIELD_CONSENT = {
  from: 'the start and end dates of this range',
  to: 'the start and end dates of this range',
  entries: 'each check-in in this date range'
} satisfies Record<keyof AiSummaryRequest, string>;

export const ENTRY_FIELD_CONSENT = {
  occurredAt: 'its date and time',
  intensity: 'intensity',
  locations: 'body-region labels',
  refinedLocations: 'precision-area labels',
  sensations: 'sensations',
  activities: 'activities',
  sleep: 'sleep',
  stress: 'stress',
  mood: 'mood',
  cycle: 'cycle phase',
  medications: 'medications',
  note: 'your note text'
} satisfies Record<keyof AiRequestEntry, string>;

export const MEDICATION_FIELD_CONSENT = {
  name: 'name',
  perceivedEffect: 'perceived effect'
} satisfies Record<keyof AiRequestMedication, string>;

export const FINDINGS_FIELD_CONSENT = {
  range: 'the start and end dates of this range',
  overview: 'the number of check-ins and the lowest, middle, and highest intensity',
  trend: 'any change in average intensity across the range',
  associations: 'average intensity with and without a location, sensation, activity, sleep, stress, mood, or cycle value',
  outliers: 'the date and intensity of check-ins that stand out',
  locations: 'recurring and first-recorded locations',
  sensations: 'recurring and first-recorded sensations',
  gaps: 'gaps between check-ins',
  treatments: 'how often each medication was logged, with its perceived effects',
  notes: 'your note text with its date',
  omittedNotes: 'how many older notes were left out'
} satisfies Record<keyof NarrativeFindings, string>;

// Not part of the JSON body: sent as X-Tender-Safety-ID and passed to the
// provider (Anthropic metadata.user_id, OpenAI safety_identifier).
export const SAFETY_ID_CONSENT = 'a random safety ID created on this device';

export const NOT_SENT_CONSENT = 'Times of day never reach the AI provider. Record IDs, when entries were created or edited, '
  + 'medication doses, and per-area intensity and sensation details are not sent at all.';

function list(items: string[], separator = ',') {
  const unique = [...new Set(items)];
  return unique.length === 1 ? unique[0] : `${unique.slice(0, -1).join(`${separator} `)}${separator} and ${unique[unique.length - 1]}`;
}

const entryPhrases = Object.entries(ENTRY_FIELD_CONSENT).map(([field, phrase]) => field === 'medications'
  ? `${phrase} (${Object.values(MEDICATION_FIELD_CONSENT).join(' and ')})`
  : phrase);

/** What leaves the device, to Tender's server. */
export const AI_CONSENT_DEVICE_TEXT = `Sent to Tender's server for ${REQUEST_FIELD_CONSENT.entries}: ${list(entryPhrases)}; `
  + `also ${REQUEST_FIELD_CONSENT.from}, and ${SAFETY_ID_CONSENT}.`;

/** What reaches the AI provider: computed findings only. */
export const AI_CONSENT_PROVIDER_TEXT = 'Tender\'s server turns these into a short summary of patterns and sends the AI provider only that summary, '
  + `plus the safety ID, which the provider can use for abuse monitoring. The summary holds ${list(Object.values(FINDINGS_FIELD_CONSENT), ';')}. `
  + NOT_SENT_CONSENT;

export const AI_CONSENT_FIELDS_TEXT = `${AI_CONSENT_DEVICE_TEXT} ${AI_CONSENT_PROVIDER_TEXT}`;

/**
 * Shown up front, above "What exactly is sent". Kept short (under 50 words,
 * tested) and true to the detailed text: notes do reach the provider, as
 * part of the computed summary.
 */
export const AI_CONSENT_SUMMARY_TEXT = 'When you choose Generate, this date range\'s check-ins, including your notes, go to Tender\'s server. '
  + 'The AI provider receives only a summary computed from them, with your note text, never your individual check-ins.';
