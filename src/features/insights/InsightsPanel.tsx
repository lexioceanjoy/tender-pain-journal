import { useMemo, useState } from 'react';
import type { PainEntry } from '../../shared/data/painEntry';
import { appointmentReportFilename, buildAppointmentReport } from '../reports/appointmentReport';
import { buildInsights } from './insights';

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
              <ul>{summary.commonRegions.map((region) => <li key={region.id}><span>{region.label}</span><strong>{region.count}× · avg {region.averageIntensity}/10</strong></li>)}</ul>
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
              <ul>{summary.commonActivities.map((activity) => <li key={activity.label}><span>{activity.label}</span><strong>{activity.count}×</strong></li>)}</ul>
              <p>These are co-occurrences in your entries, not evidence that an activity caused pain.</p>
            </div>
          )}
          <div className="report-action">
            <button type="button" onClick={downloadAppointmentSummary}>Download appointment summary</button>
            <p>A plain-text report you can read first, then choose whether to share. Nothing is sent automatically.</p>
          </div>
          <div className="ai-placeholder">
            <strong>AI narrative is off</strong>
            <p>Your records have stayed on this device. A later opt-in step can turn selected observations into an appointment summary after explaining what would be shared.</p>
          </div>
        </>
      )}
    </section>
  );
}

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}
