import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPainEntry } from '../../shared/data/painEntry';
import { AiNarrativePanel } from './AiNarrativePanel';

const readyProviderInfo = {
  provider: 'anthropic',
  displayName: 'Anthropic',
  privacyNoticeUrl: 'https://example.com/anthropic-privacy',
  retentionSummary: 'Anthropic retains submitted data for a limited period, which may be longer in specific cases.',
  ready: true
};

function stubFetch({
  providerInfo = readyProviderInfo,
  providerInfoFails = false,
  narrative = 'Pain was recorded most often in the left buttock.'
}: { providerInfo?: typeof readyProviderInfo; providerInfoFails?: boolean; narrative?: string } = {}) {
  const fetchMock = vi.fn((url: string) => {
    if (url === '/api/ai-provider-info') {
      if (providerInfoFails) return Promise.reject(new Error('network down'));
      return Promise.resolve({ ok: true, json: async () => providerInfo });
    }
    return Promise.resolve({ ok: true, json: async () => ({ narrative }) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('AI narrative consent', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not send records before consent and can clear the local result', async () => {
    const fetchMock = stubFetch();
    const entry = createPainEntry({ regions: ['choir-b23'], intensity: 7 });
    const user = userEvent.setup();
    render(<AiNarrativePanel entries={[entry]} from="2026-08-01" to="2026-08-07" />);

    expect(screen.getByRole('button', { name: 'Generate narrative' })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalledWith('/api/ai-summary', expect.anything());
    await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeDisabled());
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Generate narrative' }));
    await waitFor(() => expect(screen.getByText(/Pain was recorded most often/)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Clear and revoke' }));
    expect(screen.queryByText(/Pain was recorded most often/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate narrative' })).toBeDisabled();
  });

  it('renders privacyNoticeUrl as a followable link, not decorative text', async () => {
    stubFetch();
    const entry = createPainEntry({ regions: ['choir-b23'], intensity: 7 });
    render(<AiNarrativePanel entries={[entry]} from="2026-08-01" to="2026-08-07" />);

    const link = await screen.findByRole('link', { name: /Anthropic/ });
    expect(link).toHaveAttribute('href', 'https://example.com/anthropic-privacy');
  });

  it('renders the app\'s own-behavior copy regardless of which provider is active', async () => {
    stubFetch({
      providerInfo: {
        ...readyProviderInfo,
        provider: 'openai',
        displayName: 'OpenAI',
        privacyNoticeUrl: 'https://example.com/openai-privacy',
        retentionSummary: 'OpenAI retains submitted data for a limited period, which may be longer in specific cases.'
      }
    });
    const entry = createPainEntry({ regions: ['choir-b23'], intensity: 7 });
    render(<AiNarrativePanel entries={[entry]} from="2026-08-01" to="2026-08-07" />);

    await screen.findByRole('link', { name: /OpenAI/ });
    expect(screen.getByText(/Sent for each check-in in this date range/)).toBeInTheDocument();
    expect(screen.getByText('Insights and appointment export work without this.')).toBeInTheDocument();
    expect(screen.getByText(/This request goes to OpenAI\./)).toBeInTheDocument();
  });

  it('renders the provider\'s retentionSummary text with no specific day/year count', async () => {
    stubFetch();
    const entry = createPainEntry({ regions: ['choir-b23'], intensity: 7 });
    render(<AiNarrativePanel entries={[entry]} from="2026-08-01" to="2026-08-07" />);

    const summaryText = await screen.findByText(readyProviderInfo.retentionSummary);
    expect(summaryText.textContent).not.toMatch(/\d/);
  });

  it('renders generic fallback copy, not a stale/wrong vendor name, when the provider-info fetch fails', async () => {
    stubFetch({ providerInfoFails: true });
    const entry = createPainEntry({ regions: ['choir-b23'], intensity: 7 });
    render(<AiNarrativePanel entries={[entry]} from="2026-08-01" to="2026-08-07" />);

    await waitFor(() => expect(screen.getByText(/This request goes to the configured AI provider\./)).toBeInTheDocument());
    expect(screen.queryByText('OpenAI')).not.toBeInTheDocument();
    expect(screen.queryByText('Anthropic')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('disables Generate and explains why when ready is false, even if consent is checked', async () => {
    stubFetch({ providerInfo: { ...readyProviderInfo, ready: false } });
    const entry = createPainEntry({ regions: ['choir-b23'], intensity: 7 });
    render(<AiNarrativePanel entries={[entry]} from="2026-08-01" to="2026-08-07" />);

    await screen.findByText(/isn.t available right now/);
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Generate narrative' })).toBeDisabled();
  });

  it('shows a labeled sample narrative, never the raw error, and keeps the private observations working when generation fails', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/ai-provider-info') return Promise.resolve({ ok: true, json: async () => readyProviderInfo });
      return Promise.resolve({ ok: false, json: async () => ({ error: 'The AI narrative could not be generated.' }) });
    });
    vi.stubGlobal('fetch', fetchMock);
    const entry = createPainEntry({ regions: ['choir-b23'], intensity: 7 });
    const user = userEvent.setup();
    render(<AiNarrativePanel entries={[entry]} from="2026-08-01" to="2026-08-07" />);

    await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeDisabled());
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Generate narrative' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('still work without AI'));
    expect(screen.getByText('Pre-written example — not generated by AI')).toBeInTheDocument();
    expect(screen.queryByText('The AI narrative could not be generated.')).not.toBeInTheDocument();
  });

  it('shows the same labeled sample, not a raw error, when the demo passphrase is missing or wrong', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/ai-provider-info') return Promise.resolve({ ok: true, json: async () => readyProviderInfo });
      return Promise.resolve({ ok: false, json: async () => ({ error: 'Passphrase required.' }) });
    });
    vi.stubGlobal('fetch', fetchMock);
    const entry = createPainEntry({ regions: ['choir-b23'], intensity: 7 });
    const user = userEvent.setup();
    render(<AiNarrativePanel entries={[entry]} from="2026-08-01" to="2026-08-07" />);

    await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeDisabled());
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Generate narrative' }));

    await waitFor(() => expect(screen.getByText('Pre-written example — not generated by AI')).toBeInTheDocument());
    expect(screen.queryByText('Passphrase required.')).not.toBeInTheDocument();
  });

  it('sends whatever demo access code was entered as a header on the generate request', async () => {
    const fetchMock = stubFetch();
    const entry = createPainEntry({ regions: ['choir-b23'], intensity: 7 });
    const user = userEvent.setup();
    render(<AiNarrativePanel entries={[entry]} from="2026-08-01" to="2026-08-07" />);

    await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeDisabled());
    await user.click(screen.getByText('Have a demo access code?'));
    await user.type(screen.getByLabelText('Demo access code'), 'test-demo-code');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Generate narrative' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/ai-summary', expect.objectContaining({
      headers: expect.objectContaining({ 'X-Tender-Demo-Passphrase': 'test-demo-code' })
    })));
  });
});
