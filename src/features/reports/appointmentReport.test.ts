import { describe, expect, it } from 'vitest';
import type { InsightSummary } from '../insights/insights';
import { appointmentReportFilename, buildAppointmentReport } from './appointmentReport';

const summary: InsightSummary = {
  entries: [{
    id: 'entry-one',
    schemaVersion: 1,
    createdAt: '2026-07-20T10:00:00+08:00',
    updatedAt: '2026-07-20T10:00:00+08:00',
    occurredAt: '2026-07-20T10:00:00+08:00',
    regions: ['back-low-left'],
    intensity: 8,
    sensations: ['tingling'],
    context: {
      activities: ['Long sitting'],
      sleep: 'poor',
      medications: [{ name: 'Ibuprofen', dose: '200 mg', perceivedEffect: 'helped' }]
    },
    note: 'Improved after walking.'
  }],
  averageIntensity: 8,
  highPainEntries: 1,
  commonRegions: [{ id: 'back-low-left', label: 'Left low back', count: 1, averageIntensity: 8 }],
  commonPrecisionAreas: [],
  commonActivities: [{ label: 'Long sitting', count: 1 }]
};

describe('appointment report', () => {
  it('presents recorded facts, context, and a non-diagnostic caution', () => {
    const report = buildAppointmentReport(summary, '2026-07-20', '2026-07-21');

    expect(report).toContain('Average recorded pain intensity: 8/10');
    expect(report).toContain('Areas: Left low back — 8/10, tingling');
    expect(report).toContain('Medication: Ibuprofen (200 mg, effect: helped)');
    expect(report).toContain('does not provide a diagnosis');
    expect(report).toContain('not evidence that an activity caused pain');
  });

  it('shows area-specific exceptions without changing the overall entry', () => {
    const customized: InsightSummary = {
      ...summary,
      entries: [{
        ...summary.entries[0],
        regions: ['back-low-left', 'foot-left'],
        areaDetails: [{ regionId: 'foot-left', intensity: 2, sensations: ['numb'] }]
      }]
    };

    const report = buildAppointmentReport(customized, '2026-07-20', '2026-07-21');
    expect(report).toContain('Left low back — 8/10, tingling');
    expect(report).toContain('Left foot — 2/10, numb');
  });

  it('labels refined locations as approximate Tender details', () => {
    const refined: InsightSummary = {
      ...summary,
      entries: [{
        ...summary.entries[0],
        precisionAreas: ['tender-detail-si-left']
      }],
      commonPrecisionAreas: [{ id: 'tender-detail-si-left', label: 'Left SI-joint area', count: 1 }]
    };

    const report = buildAppointmentReport(refined, '2026-07-20', '2026-07-21');
    expect(report).toContain('Left SI-joint area: 1 check-in');
    expect(report).toContain('Refined locations: Left SI-joint area (approximate Tender detail areas)');
    expect(report).toContain('have not been clinically validated');
  });

  it('uses a portable, descriptive filename', () => {
    expect(appointmentReportFilename('2026-07-20', '2026-07-21'))
      .toBe('tender-appointment-summary-2026-07-20-to-2026-07-21.txt');
  });
});
