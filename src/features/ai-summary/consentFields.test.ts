import { describe, expect, it } from 'vitest';
import { createPainEntry } from '../../shared/data/painEntry';
import { buildAiSummaryRequest } from './aiSummary';
import { aiSummaryRequestSchema } from './aiSummarySchema';
import {
  AI_CONSENT_DEVICE_TEXT,
  AI_CONSENT_FIELDS_TEXT,
  AI_CONSENT_PROVIDER_TEXT,
  AI_CONSENT_SUMMARY_TEXT,
  ENTRY_FIELD_CONSENT,
  FINDINGS_FIELD_CONSENT,
  MEDICATION_FIELD_CONSENT,
  REQUEST_FIELD_CONSENT
} from './consentFields';
import { computeFindings } from './narrativeFindings';

const entrySchema = aiSummaryRequestSchema.shape.entries.element;
const medicationSchema = entrySchema.shape.medications.unwrap().element;

// Every optional field filled, so the built request shows every key the
// payload can carry.
const fullEntry = (day: string, intensity: number) => createPainEntry({
  occurredAt: `2026-08-${day}T08:00:00.000Z`,
  regions: ['choir-b23'],
  precisionAreas: ['tender-detail-si-left'],
  areaDetails: [{ regionId: 'choir-b23', intensity: 8, sensations: ['burning'] }],
  intensity,
  sensations: ['aching'],
  activities: ['Walking'],
  sleep: 'poor',
  stress: 'high',
  mood: 'low',
  cycle: 'period',
  medication: { name: 'Ibuprofen', dose: '200 mg', perceivedEffect: 'helped' },
  note: 'Improved later.'
});
const entries = [fullEntry('01', 3), fullEntry('02', 5), fullEntry('03', 7)];
const request = buildAiSummaryRequest(entries, '2026-08-01', '2026-08-07', () => 0);
const findings = computeFindings(request);

const sorted = (keys: Iterable<string>) => [...keys].sort();

describe('AI consent copy matches what leaves the device', () => {
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

  it('puts every request field phrase into the device text', () => {
    for (const phrase of [...Object.values(REQUEST_FIELD_CONSENT), ...Object.values(ENTRY_FIELD_CONSENT), ...Object.values(MEDICATION_FIELD_CONSENT)]) {
      expect(AI_CONSENT_DEVICE_TEXT).toContain(phrase);
    }
  });
});

describe('AI consent copy matches what reaches the AI provider', () => {
  it('names every findings field, and no others', () => {
    expect(sorted(Object.keys(findings))).toEqual(sorted(Object.keys(FINDINGS_FIELD_CONSENT)));
  });

  it('puts every findings phrase into the provider text', () => {
    for (const phrase of Object.values(FINDINGS_FIELD_CONSENT)) expect(AI_CONSENT_PROVIDER_TEXT).toContain(phrase);
  });
});

describe('the up-front consent summary', () => {
  it('stays under 50 words and two sentences', () => {
    expect(AI_CONSENT_SUMMARY_TEXT.trim().split(/\s+/).length).toBeLessThan(50);
    expect(AI_CONSENT_SUMMARY_TEXT.match(/[.!?](\s|$)/g)).toHaveLength(2);
  });

  it('says notes go to the provider and individual check-ins never do, as the detailed text does', () => {
    expect(AI_CONSENT_SUMMARY_TEXT).toMatch(/Tender's server/);
    expect(AI_CONSENT_SUMMARY_TEXT).toMatch(/note text/);
    expect(AI_CONSENT_SUMMARY_TEXT).toMatch(/never your individual check-ins/);
    expect(AI_CONSENT_PROVIDER_TEXT).toContain(FINDINGS_FIELD_CONSENT.notes);
  });
});

describe('the "not sent" claims are true', () => {
  it('keeps record IDs, created/edited times, doses and per-area details on the device', () => {
    const sent = JSON.stringify(request);
    for (const entry of entries) expect(sent).not.toContain(entry.id);
    for (const absent of ['createdAt', 'updatedAt', 'areaDetails', 'burning', 'dose', '200 mg']) expect(sent).not.toContain(absent);
  });

  it('sends the AI provider no times of day', () => {
    expect(JSON.stringify(findings)).not.toMatch(/T\d\d:\d\d/);
    expect(AI_CONSENT_FIELDS_TEXT).not.toMatch(/never[^.]*timestamps/i);
  });
});
