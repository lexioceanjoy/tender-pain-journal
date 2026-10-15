import { useEffect, useState } from 'react';
import type { PainEntry } from '../../shared/data/painEntry';
import { buildAiSummaryRequest, tenderSafetyId } from './aiSummary';
import { getDemoPassphrase, setDemoPassphrase } from './demoAccess';
import { fetchProviderInfo, type ProviderInfo } from './providerInfo';
import { SAMPLE_NARRATIVE, SAMPLE_NARRATIVE_LABEL } from './sampleNarrative';

type Props = { entries: PainEntry[]; from: string; to: string };

export function AiNarrativePanel({ entries, from, to }: Props) {
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
  const [consented, setConsented] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
  const [narrative, setNarrative] = useState('');
  const [passphraseDraft, setPassphraseDraft] = useState(() => getDemoPassphrase());

  useEffect(() => {
    fetchProviderInfo().then(setProviderInfo);
  }, []);

  function onPassphraseChange(value: string) {
    setPassphraseDraft(value);
    setDemoPassphrase(value);
  }

  const ready = providerInfo?.ready ?? false;
  const displayName = providerInfo?.displayName ?? 'the configured AI provider';

  async function generate() {
    if (!consented || !entries.length || !ready) return;
    setState('loading');
    try {
      const response = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tender-Safety-ID': tenderSafetyId(),
          'X-Tender-Demo-Passphrase': getDemoPassphrase()
        },
        body: JSON.stringify(buildAiSummaryRequest(entries, from, to))
      });
      const result = await response.json() as { narrative?: string; error?: string };
      if (!response.ok || !result.narrative) throw new Error('AI summary unavailable.');
      setNarrative(result.narrative);
      setState('done');
    } catch {
      // Never show the raw error (wrong/missing demo passphrase and any
      // provider failure look identical to a visitor): fall through to
      // the labeled sample narrative below instead.
      setState('error');
    }
  }

  function revoke() {
    setConsented(false);
    setNarrative('');
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
      {!narrative && (
        <details className="ai-demo-gate">
          <summary>Have a demo access code?</summary>
          <label>
            <span>Demo access code</span>
            <input
              type="password"
              autoComplete="off"
              value={passphraseDraft}
              onChange={(event) => onPassphraseChange(event.target.value)}
            />
          </label>
        </details>
      )}
      {state === 'error' && (
        <div className="ai-sample">
          <strong>{SAMPLE_NARRATIVE_LABEL}</strong>
          <p>{SAMPLE_NARRATIVE}</p>
        </div>
      )}
      {state === 'error' && <p className="ai-error" role="alert">The private observations above still work without AI.</p>}
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
