import { describe, expect, it } from 'vitest';
import { createPainEntry } from '../../shared/data/painEntry';
import { buildAiSummaryRequest } from './aiSummary';
import { aiSummaryRequestSchema } from './aiSummarySchema';
import {
  AI_CONSENT_FIELDS_TEXT,
  ENTRY_FIELD_CONSENT,
  MEDICATION_FIELD_CONSENT,
  REQUEST_FIELD_CONSENT
} from './consentFields';

const entrySchema = aiSummaryRequestSchema.shape.entries.element;
const medicationSchema = entrySchema.shape.medications.unwrap().element;

// Every optional field filled, so the built request shows every key the
// payload can carry.
const fullEntry = createPainEntry({
  occurredAt: '2026-08-01T08:00:00.000Z',
  regions: ['choir-b23'],
  precisionAreas: ['tender-detail-si-left'],
  areaDetails: [{ regionId: 'choir-b23', intensity: 8, sensations: ['burning'] }],
  intensity: 7,
  sensations: ['aching'],
  activities: ['Walking'],
  sleep: 'poor',
  stress: 'high',
  mood: 'low',
  cycle: 'period',
  medication: { name: 'Ibuprofen', dose: '200 mg', perceivedEffect: 'helped' },
  note: 'Improved later.'
});
const request = buildAiSummaryRequest([fullEntry], '2026-08-01', '2026-08-07');

const sorted = (keys: Iterable<string>) => [...keys].sort();

describe('AI consent copy matches the payload', () => {
  it('names every field the request schema accepts, and no others', () => {
    expect(sorted(Object.keys(REQUEST_FIELD_CONSENT))).toEqual(sorted(Object.keys(aiSummaryRequestSchema.shape)));
    expect(sorted(Object.keys(ENTRY_FIELD_CONSENT))).toEqual(sorted(Object.keys(entrySchema.shape)));
    expect(sorted(Object.keys(MEDICATION_FIELD_CONSENT))).toEqual(sorted(Object.keys(medicationSchema.shape)));
  });

  it('names every field a real request from a fully filled entry carries, and no others', () => {
    const entry = request.entries[0];
    expect(sorted(Object.keys(request))).toEqual(sorted(Object.keys(REQUEST_FIELD_CONSENT)));
    expect(sorted(Object.keys(entry))).toEqual(sorted(Object.keys(ENTRY_FIELD_CONSENT)));
    expect(sorted(Object.keys(entry.medications![0]))).toEqual(sorted(Object.keys(MEDICATION_FIELD_CONSENT)));
  });

  it('puts every field phrase into the consent text', () => {
    for (const phrase of [...Object.values(REQUEST_FIELD_CONSENT), ...Object.values(ENTRY_FIELD_CONSENT), ...Object.values(MEDICATION_FIELD_CONSENT)]) {
      expect(AI_CONSENT_FIELDS_TEXT).toContain(phrase);
    }
  });

  it('only claims as not sent what the request really leaves out', () => {
    const sent = JSON.stringify(request);
    expect(sent).not.toContain(fullEntry.id);
    expect(sent).not.toContain('createdAt');
    expect(sent).not.toContain('updatedAt');
    expect(sent).not.toContain('areaDetails');
    expect(sent).not.toContain('burning');
    expect(AI_CONSENT_FIELDS_TEXT).not.toMatch(/never[^.]*timestamps/i);
  });
});
