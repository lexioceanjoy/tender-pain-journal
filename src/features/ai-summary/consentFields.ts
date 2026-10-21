import type { AiSummaryRequest } from './aiSummarySchema';

type AiRequestEntry = AiSummaryRequest['entries'][number];
type AiRequestMedication = NonNullable<AiRequestEntry['medications']>[number];

// The consent copy is built from these maps, one phrase per field the AI
// request carries. `satisfies` makes a missing or extra key a type error;
// consentFields.test.ts checks the same against the runtime schema and a
// real request, so the copy can't drift from the payload.
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
  dose: 'dose',
  perceivedEffect: 'perceived effect'
} satisfies Record<keyof AiRequestMedication, string>;

// Not part of the JSON body: sent as X-Tender-Safety-ID and passed to the
// provider (Anthropic metadata.user_id, OpenAI safety_identifier).
export const SAFETY_ID_CONSENT = 'a random safety ID created on this device, which the provider can use for abuse monitoring';

// Kept local by buildAiSummaryRequest; named so the copy says so.
export const NOT_SENT_CONSENT = 'Record IDs, when entries were created or edited, and per-area intensity and sensation details are not sent.';

function list(items: string[]) {
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

const entryPhrases = Object.entries(ENTRY_FIELD_CONSENT).map(([field, phrase]) => field === 'medications'
  ? `${phrase} (${list(Object.values(MEDICATION_FIELD_CONSENT))})`
  : phrase);

export const AI_CONSENT_FIELDS_TEXT = `Sent for ${REQUEST_FIELD_CONSENT.entries}: ${list(entryPhrases)}. `
  + `Also sent: ${REQUEST_FIELD_CONSENT.from}, and ${SAFETY_ID_CONSENT}. ${NOT_SENT_CONSENT}`;
