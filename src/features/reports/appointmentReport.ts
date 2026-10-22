import { findBodyRegion } from '../body-map/bodyRegions';
import { findPrecisionArea } from '../body-map/precisionAreas';
import { activityMarkers, formatShortDate, regionTiming, type InsightSummary } from '../insights/insights';
import { activityEffectLabels, getAreaDetails, interferenceLabels, interferenceOptions, patternLabels } from '../../shared/data/painEntry';

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
    ...listOrFallback(summary.commonRegions.map((region) => `${region.label}: ${region.count} check-in${region.count === 1 ? '' : 's'}, average ${region.averageIntensity}/10${regionTiming(region) ? ` (${regionTiming(region)})` : ''}`)),
    'Check-ins are samples: "since" is when recording started, not how long pain has lasted.',
    '',
    'NEW IN THIS PERIOD (not recorded in the 30 days before)',
    ...listOrFallback((summary.newAreas ?? []).map((area) => `${area.label}: first recorded ${formatShortDate(area.firstRecorded)}`)),
    '',
    'MOST RECORDED REFINED LOCATIONS',
    ...listOrFallback((summary.commonPrecisionAreas ?? []).map((area) => `${area.label}: ${area.count} check-in${area.count === 1 ? '' : 's'}`)),
    'Refined locations are approximate Tender detail areas within broader CHOIR regions and have not been clinically validated.',
    '',
    'ACTIVITIES RECORDED ALONGSIDE PAIN',
    ...listOrFallback(summary.commonActivities.map((activity) => `${activity.label}: ${activity.count} check-in${activity.count === 1 ? '' : 's'}${activityMarkers(activity) ? ` (${activityMarkers(activity)})` : ''}`)),
    'These are co-occurrences, not evidence that an activity caused pain. Markers are the person\'s own.',
    '',
    'DAYS PAIN GOT IN THE WAY (as recorded; days without an answer are not counted)',
    ...listOrFallback(summary.interference ? [
      ...interferenceOptions.filter((level) => summary.interference!.levels[level] > 0)
        .map((level) => `${interferenceLabels[level]}: ${summary.interference!.levels[level]} day${summary.interference!.levels[level] === 1 ? '' : 's'}`),
      ...summary.interference.areas.map((item) => `Got in the way of ${item.area}: ${item.days} day${item.days === 1 ? '' : 's'}`)
    ] : []),
    ...(summary.painWoke ? ['', `Pain woke the person on ${summary.painWoke.nights} night${summary.painWoke.nights === 1 ? '' : 's'} (of ${summary.painWoke.ofNights} with a sleep answer).`] : []),
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
          entry.context?.activities?.length ? `Activities: ${entry.context.activities.map((activity) => {
            const effect = entry.context?.activityEffects?.[activity];
            return effect ? `${activity} (you marked: ${activityEffectLabels[effect]})` : activity;
          }).join(', ')}` : undefined,
          entry.context?.interference
            ? `Got in the way: ${interferenceLabels[entry.context.interference].toLowerCase()}${entry.context.interferenceAreas?.length ? ` — ${entry.context.interferenceAreas.join(', ')}` : ''}`
            : undefined,
          entry.areaPatterns?.length
            ? `Pattern: ${entry.areaPatterns.map((item) => `${findBodyRegion(item.regionId)?.label ?? item.regionId} — ${patternLabels[item.pattern].toLowerCase()}`).join('; ')}`
            : undefined,
          entry.context?.sleep || entry.context?.painWokeMe
            ? `Sleep: ${[entry.context?.sleep, entry.context?.painWokeMe ? 'pain woke me' : undefined].filter(Boolean).join('; ')}`
            : undefined,
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
