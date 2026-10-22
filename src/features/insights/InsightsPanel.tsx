import { useMemo, useState } from 'react';
import type { PainEntry } from '../../shared/data/painEntry';
import { appointmentReportFilename, buildAppointmentReport } from '../reports/appointmentReport';
import { interferenceLabels, interferenceOptions } from '../../shared/data/painEntry';
import { activityMarkers, buildInsights, formatShortDate, regionTiming } from './insights';
import { AiNarrativePanel } from '../ai-summary/AiNarrativePanel';

export function InsightsPanel({ entries }: { entries: PainEntry[] }) {
  const [from, setFrom] = useState(() => dateDaysAgo(29));
  const [to, setTo] = useState(() => dateDaysAgo(0));
  const summary = useMemo(() => buildInsights(entries, from, to), [entries, from, to]);

  function downloadAppointmentSummary() {
    const report = buildAppointmentReport(summary, from, to);
    const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = appointmentReportFilename(from, to);
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="insights-panel" aria-labelledby="insights-heading">
      <p className="eyebrow">Private summary</p>
      <h2 id="insights-heading">What your records show</h2>
      <div className="date-range">
        <label>From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      {summary.entries.length === 0 ? (
        <p className="insight-empty">No check-ins fall within this date range yet.</p>
      ) : (
        <>
          <div className="insight-stats">
            <div><strong>{summary.entries.length}</strong><span>check-ins</span></div>
            <div><strong>{summary.averageIntensity}</strong><span>average overall intensity</span></div>
            <div><strong>{summary.highPainEntries}</strong><span>at 7/10 or higher</span></div>
          </div>
          {summary.commonRegions.length > 0 && (
            <div className="observation-block">
              <h3>Most recorded locations</h3>
              <ul>{summary.commonRegions.map((region) => (
                <li key={region.id}>
                  <span>{region.label}{regionTiming(region) && <><br /><small className="muted">{regionTiming(region)}</small></>}</span>
                  <strong>{region.count}× · avg {region.averageIntensity}/10</strong>
                </li>
              ))}</ul>
              <p>Check-ins are samples, so “since” is when recording started, not how long pain has lasted.</p>
            </div>
          )}
          {summary.newAreas.length > 0 && (
            <div className="observation-block">
              <h3>New in this period</h3>
              <ul>{summary.newAreas.map((area) => <li key={area.id}><span>{area.label}</span><strong>first recorded {formatShortDate(area.firstRecorded)}</strong></li>)}</ul>
              <p>Not recorded in the 30 days before.</p>
            </div>
          )}
          {summary.commonPrecisionAreas.length > 0 && (
            <div className="observation-block">
              <h3>Most recorded refined locations</h3>
              <ul>{summary.commonPrecisionAreas.map((area) => <li key={area.id}><span>{area.label}</span><strong>{area.count}×</strong></li>)}</ul>
              <p>These are approximate Tender detail areas recorded within broader CHOIR regions.</p>
            </div>
          )}
          {summary.commonActivities.length > 0 && (
            <div className="observation-block">
              <h3>Context recorded alongside pain</h3>
              <ul>{summary.commonActivities.map((activity) => (
                <li key={activity.label}>
                  <span>{activity.label}{activityMarkers(activity) && <><br /><small className="muted">{activityMarkers(activity)}</small></>}</span>
                  <strong>{activity.count}×</strong>
                </li>
              ))}</ul>
              <p>These are co-occurrences in your entries, not evidence that an activity caused pain.{summary.commonActivities.some((activity) => activity.worse || activity.helped) && ' “Made worse” and “helped” are your own markers.'}</p>
            </div>
          )}
          {summary.interference && (
            <div className="observation-block">
              <h3>Days pain got in the way</h3>
              <ul>
                {interferenceOptions.filter((level) => summary.interference!.levels[level] > 0).map((level) => (
                  <li key={level}><span>{interferenceLabels[level]}</span><strong>{summary.interference!.levels[level]} day{summary.interference!.levels[level] === 1 ? '' : 's'}</strong></li>
                ))}
                {summary.interference.areas.map((item) => (
                  <li key={item.area}><span>Got in the way of {item.area}</span><strong>{item.days} day{item.days === 1 ? '' : 's'}</strong></li>
                ))}
              </ul>
              <p>As you recorded it. Days without an answer aren’t counted.</p>
            </div>
          )}
          {summary.painWoke && (
            <div className="observation-block">
              <h3>Sleep</h3>
              <p className="insight-line">Pain woke you on {summary.painWoke.nights} night{summary.painWoke.nights === 1 ? '' : 's'} (of {summary.painWoke.ofNights} with a sleep answer).</p>
            </div>
          )}
          <div className="report-action">
            <button type="button" onClick={downloadAppointmentSummary}>Download appointment summary</button>
            <p>A plain-text report you can read first, then choose whether to share. Nothing is sent automatically.</p>
          </div>
          <AiNarrativePanel entries={summary.entries} from={from} to={to} />
        </>
      )}
    </section>
  );
}

export function dateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
