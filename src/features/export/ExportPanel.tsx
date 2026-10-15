import { useState } from 'react';
import type { PainEntry } from '../../shared/data/painEntry';
import { buildExportCsv, buildExportJson, exportFilename } from './export';

type Props = { entries: PainEntry[] };

export function ExportPanel({ entries }: Props) {
  const [status, setStatus] = useState('');

  function download(format: 'json' | 'csv') {
    const content = format === 'json' ? buildExportJson(entries) : buildExportCsv(entries);
    const type = format === 'json' ? 'application/json' : 'text/csv;charset=utf-8';
    const file = new Blob([content], { type });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFilename(format);
    link.click();
    URL.revokeObjectURL(url);
    setStatus(`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} exported as ${format.toUpperCase()}.`);
  }

  return (
    <details className="export-panel">
      <summary>Export your data <span>Local only</span></summary>
      <div className="export-content">
        <p>Download every check-in on this device — not just what&rsquo;s currently shown in Insights — as JSON or a spreadsheet-ready CSV. Locations use the same plain-language labels shown in the app, never internal IDs.</p>
        {entries.length === 0 ? (
          <p className="export-empty">There are no check-ins to export yet.</p>
        ) : (
          <div className="export-actions">
            <button type="button" onClick={() => download('json')}>Download JSON</button>
            <button type="button" className="secondary" onClick={() => download('csv')}>Download CSV</button>
          </div>
        )}
        {status && <p className="export-status" role="status">{status}</p>}
      </div>
    </details>
  );
}
