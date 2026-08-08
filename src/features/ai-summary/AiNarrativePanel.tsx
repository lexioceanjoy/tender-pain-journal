import { useState } from 'react';
import type { PainEntry } from '../../shared/data/painEntry';
import { buildAiSummaryRequest, tenderSafetyId } from './aiSummary';

type Props = { entries: PainEntry[]; from: string; to: string };

export function AiNarrativePanel({ entries, from, to }: Props) {
  const [consented, setConsented] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
  const [narrative, setNarrative] = useState('');
  const [error, setError] = useState('');

  async function generate() {
    if (!consented || !entries.length) return;
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
      <p>Your current date-range records—including locations, intensity, optional context, medication and notes—will be sent to OpenAI only when you choose Generate. Tender asks for a non-diagnostic summary and does not upload your full diary or API key.</p>
      <p>Tender requests no saved response. OpenAI states API data is not used for training unless the account opts in; default safety-monitoring logs may retain content for up to 30 days depending on account controls. <a href="https://platform.openai.com/docs/models/default-usage-policies-by-endpoint" target="_blank" rel="noreferrer">Review OpenAI data controls</a>.</p>
      {!narrative && (
        <label className="ai-consent">
          <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} />
          <span>I understand what will leave this device for this request.</span>
        </label>
      )}
      {state === 'error' && <p className="ai-error" role="alert">{error} The private observations above still work without AI.</p>}
      {narrative && <div className="ai-result"><strong>AI-written summary</strong><p>{narrative}</p></div>}
      <div className="ai-actions">
        {!narrative && <button type="button" disabled={!consented || !entries.length || state === 'loading'} onClick={generate}>{state === 'loading' ? 'Writing…' : 'Generate narrative'}</button>}
        {(consented || narrative) && <button className="secondary" type="button" onClick={revoke}>Clear and revoke</button>}
      </div>
      <p className="ai-disclaimer">Review before sharing. This narrative may be incomplete or mistaken and does not diagnose, triage, or recommend treatment.</p>
      {(consented || narrative) && <p className="ai-disclaimer">Clearing revokes consent for another request and removes this on-screen result. It cannot undo a request already sent.</p>}
    </section>
  );
}
