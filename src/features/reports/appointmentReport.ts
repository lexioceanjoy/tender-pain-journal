import { findBodyRegion } from '../body-map/bodyRegions';
import { findPrecisionArea } from '../body-map/precisionAreas';
import type { InsightSummary } from '../insights/insights';
import { getAreaDetails } from '../../shared/data/painEntry';

export function buildAppointmentReport(summary: InsightSummary, from: string, to: string) {
  const lines = [
    'Tender — appointment summary',
    `Recorded period: ${formatDate(from)} to ${formatDate(to)}`,
    `Created: ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`,
    '',
    'ABOUT THIS SUMMARY',
    'This report reflects information recorded by the user. It highlights patterns in the diary and does not provide a diagnosis or establish that one factor caused another.',
    '',
    'OVERVIEW',
    `Check-ins: ${summary.entries.length}`,
    `Average recorded pain intensity: ${summary.averageIntensity ?? '—'}/10`,
    `Check-ins at 7/10 or higher: ${summary.highPainEntries}`,
    '',
    'MOST RECORDED LOCATIONS',
    ...listOrFallback(summary.commonRegions.map((region) => `${region.label}: ${region.count} check-in${region.count === 1 ? '' : 's'}, average ${region.averageIntensity}/10`)),
    '',
    'MOST RECORDED REFINED LOCATIONS',
    ...listOrFallback((summary.commonPrecisionAreas ?? []).map((area) => `${area.label}: ${area.count} check-in${area.count === 1 ? '' : 's'}`)),
    'Refined locations are approximate Tender detail areas within broader CHOIR regions and have not been clinically validated.',
    '',
    'ACTIVITIES RECORDED ALONGSIDE PAIN',
    ...listOrFallback(summary.commonActivities.map((activity) => `${activity.label}: ${activity.count} check-in${activity.count === 1 ? '' : 's'}`)),
    'These are co-occurrences, not evidence that an activity caused pain.',
    '',
    'CHECK-IN DETAILS',
    ...summary.entries
      .slice()
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
      .flatMap((entry) => {
        const context = [
          entry.precisionAreas?.length
            ? `Refined locations: ${entry.precisionAreas.map((id) => findPrecisionArea(id)?.label ?? id).join(', ')} (approximate Tender detail areas)`
            : undefined,
          entry.context?.activities?.length ? `Activities: ${entry.context.activities.join(', ')}` : undefined,
          entry.context?.sleep ? `Sleep: ${entry.context.sleep}` : undefined,
          entry.context?.stress ? `Stress: ${entry.context.stress}` : undefined,
          entry.context?.mood ? `Mood: ${entry.context.mood}` : undefined,
          entry.context?.cycle ? `Cycle: ${entry.context.cycle}` : undefined,
          entry.context?.medications?.length
            ? `Medication: ${entry.context.medications.map(formatMedication).join('; ')}`
            : undefined,
          entry.note ? `Note: ${entry.note}` : undefined
        ].filter((value): value is string => Boolean(value));

        return [
          '',
          `${formatDateTime(entry.occurredAt)} — ${entry.intensity}/10`,
          `Areas: ${entry.regions.map((id) => formatArea(entry, id)).join('; ')}`,
          ...context
        ];
      })
  ];

  return lines.join('\n').trimEnd();
}

function formatArea(entry: InsightSummary['entries'][number], regionId: string) {
  const detail = getAreaDetails(entry, regionId);
  const sensations = detail.sensations.length ? `, ${detail.sensations.join(', ')}` : '';
  return `${findBodyRegion(regionId)?.label ?? regionId} — ${detail.intensity}/10${sensations}`;
}

export function appointmentReportFilename(from: string, to: string) {
  return `tender-appointment-summary-${from}-to-${to}.txt`;
}

function formatMedication(medication: {
  name: string;
  dose?: string;
  perceivedEffect?: 'helped' | 'no-change' | 'not-sure';
}) {
  const details = [
    medication.dose,
    medication.perceivedEffect ? `effect: ${medication.perceivedEffect.replaceAll('-', ' ')}` : undefined
  ].filter(Boolean);
  return details.length ? `${medication.name} (${details.join(', ')})` : medication.name;
}

function listOrFallback(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`) : ['- None recorded'];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
