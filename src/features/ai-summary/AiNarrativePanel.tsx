import { useEffect, useState } from 'react';
import type { PainEntry } from '../../shared/data/painEntry';
import { buildAiSummaryRequest, tenderSafetyId } from './aiSummary';
import { fetchProviderInfo, type ProviderInfo } from './providerInfo';

type Props = { entries: PainEntry[]; from: string; to: string };

export function AiNarrativePanel({ entries, from, to }: Props) {
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
  const [consented, setConsented] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
  const [narrative, setNarrative] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProviderInfo().then(setProviderInfo);
  }, []);

  const ready = providerInfo?.ready ?? false;
  const displayName = providerInfo?.displayName ?? 'the configured AI provider';

  async function generate() {
    if (!consented || !entries.length || !ready) return;
    setState('loading');
    setError('');
    try {
      const response = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tender-Safety-ID': tenderSafetyId()
        },
        body: JSON.stringify(buildAiSummaryRequest(entries, from, to))
      });
      const result = await response.json() as { narrative?: string; error?: string };
      if (!response.ok || !result.narrative) throw new Error(result.error ?? 'AI summary unavailable.');
      setNarrative(result.narrative);
      setState('done');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI summary unavailable.');
      setState('error');
    }
  }

  function revoke() {
    setConsented(false);
    setNarrative('');
    setError('');
    setState('idle');
  }

  return (
    <section className="ai-narrative" aria-labelledby="ai-title">
      <p className="eyebrow">Optional AI narrative</p>
      <h3 id="ai-title">Turn these records into an appointment story</h3>
      {!narrative && (
        <>
          <p>Only labels for this date range&rsquo;s regions, precision areas, sensations, intensity, activities, sleep, and medications, plus your note text, are sent — never record IDs, timestamps, or other identifiers. Nothing leaves this device unless you check the box below and choose Generate, and only for this one request.</p>
          <p>
            <span>This request goes to {displayName}.</span>{' '}
            {providerInfo?.retentionSummary && <span>{providerInfo.retentionSummary}</span>}{' '}
            {providerInfo?.privacyNoticeUrl && (
              <a href={providerInfo.privacyNoticeUrl} target="_blank" rel="noreferrer">Review {displayName}&rsquo;s data policy</a>
            )}
          </p>
          <p>Insights and appointment export work without this.</p>
        </>
      )}
      {providerInfo && !ready && !narrative && (
        <p className="ai-disclaimer" role="status">The configured AI provider isn&rsquo;t available right now.</p>
      )}
      {!narrative && (
        <label className="ai-consent">
          <input type="checkbox" checked={consented} disabled={!ready} onChange={(event) => setConsented(event.target.checked)} />
          <span>I understand what will leave this device for this request.</span>
        </label>
      )}
      {state === 'error' && <p className="ai-error" role="alert">{error} The private observations above still work without AI.</p>}
      {narrative && <div className="ai-result"><strong>AI-written summary</strong><p>{narrative}</p></div>}
      <div className="ai-actions">
        {!narrative && <button type="button" disabled={!consented || !entries.length || !ready || state === 'loading'} onClick={generate}>{state === 'loading' ? 'Writing…' : 'Generate narrative'}</button>}
        {(consented || narrative) && <button className="secondary" type="button" onClick={revoke}>Clear and revoke</button>}
      </div>
      <p className="ai-disclaimer">Review before sharing. This narrative may be incomplete or mistaken and does not diagnose, triage, or recommend treatment.</p>
      {(consented || narrative) && <p className="ai-disclaimer">Clearing revokes consent for another request and removes this on-screen result. It cannot undo a request already sent.</p>}
    </section>
  );
}
