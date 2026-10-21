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

// Three differing check-ins in range: enough to pass the pre-gate.
const threeEntries = [3, 5, 7].map((intensity, index) => createPainEntry({
  regions: ['choir-b23'], intensity, occurredAt: `2026-08-0${index + 1}T12:00:00.000Z`
}));

describe('AI narrative consent', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not send records before consent and can clear the local result', async () => {
    const fetchMock = stubFetch();
    const user = userEvent.setup();
    render(<AiNarrativePanel entries={threeEntries} from="2026-08-01" to="2026-08-07" />);

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
    render(<AiNarrativePanel entries={threeEntries} from="2026-08-01" to="2026-08-07" />);

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
    render(<AiNarrativePanel entries={threeEntries} from="2026-08-01" to="2026-08-07" />);

    await screen.findByRole('link', { name: /OpenAI/ });
    expect(screen.getByText(/The AI provider receives only a summary computed from them/)).toBeInTheDocument();
    expect(screen.getByText('What exactly is sent')).toBeInTheDocument();
    expect(screen.getByText(/Sent to Tender's server for each check-in in this date range/)).toBeInTheDocument();
    expect(screen.getByText(/sends the AI provider only that summary/)).toBeInTheDocument();
    expect(screen.getByText('Insights and appointment export work without this.')).toBeInTheDocument();
    expect(screen.getByText(/This request goes to OpenAI\./)).toBeInTheDocument();
  });

  it('renders the provider\'s retentionSummary text with no specific day/year count', async () => {
    stubFetch();
    render(<AiNarrativePanel entries={threeEntries} from="2026-08-01" to="2026-08-07" />);

    const summaryText = await screen.findByText(readyProviderInfo.retentionSummary);
    expect(summaryText.textContent).not.toMatch(/\d/);
  });

  it('renders generic fallback copy, not a stale/wrong vendor name, when the provider-info fetch fails', async () => {
    stubFetch({ providerInfoFails: true });
    render(<AiNarrativePanel entries={threeEntries} from="2026-08-01" to="2026-08-07" />);

    await waitFor(() => expect(screen.getByText(/This request goes to the configured AI provider\./)).toBeInTheDocument());
    expect(screen.queryByText('OpenAI')).not.toBeInTheDocument();
    expect(screen.queryByText('Anthropic')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('disables Generate and explains why when ready is false, even if consent is checked', async () => {
    stubFetch({ providerInfo: { ...readyProviderInfo, ready: false } });
    render(<AiNarrativePanel entries={threeEntries} from="2026-08-01" to="2026-08-07" />);

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
    const user = userEvent.setup();
    render(<AiNarrativePanel entries={threeEntries} from="2026-08-01" to="2026-08-07" />);

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
    const user = userEvent.setup();
    render(<AiNarrativePanel entries={threeEntries} from="2026-08-01" to="2026-08-07" />);

    await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeDisabled());
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Generate narrative' }));

    await waitFor(() => expect(screen.getByText('Pre-written example — not generated by AI')).toBeInTheDocument());
    expect(screen.queryByText('Passphrase required.')).not.toBeInTheDocument();
  });

  it('sends whatever demo access code was entered as a header on the generate request', async () => {
    const fetchMock = stubFetch();
    const user = userEvent.setup();
    render(<AiNarrativePanel entries={threeEntries} from="2026-08-01" to="2026-08-07" />);

    await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeDisabled());
    await user.click(screen.getByText('Have a demo access code?'));
    await user.type(screen.getByLabelText('Demo access code'), 'test-demo-code');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Generate narrative' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/ai-summary', expect.objectContaining({
      headers: expect.objectContaining({ 'X-Tender-Demo-Passphrase': 'test-demo-code' })
    })));
  });

  it('shows the pre-gate message and sends nothing when there are too few check-ins', async () => {
    const fetchMock = stubFetch();
    render(<AiNarrativePanel entries={threeEntries.slice(0, 1)} from="2026-08-01" to="2026-08-07" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/ai-provider-info'));
    expect(screen.getByRole('status')).toHaveTextContent('Not AI-generated');
    expect(screen.getByText(/needs at least 3 check-ins in this date range, and there is 1/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate narrative' })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith('/api/ai-summary', expect.anything());
  });

  it('shows the stability message for identical check-ins', async () => {
    stubFetch();
    const same = [1, 2, 3].map((day) => createPainEntry({ regions: ['choir-b23'], intensity: 4, sensations: ['aching'], occurredAt: `2026-08-0${day}T12:00:00.000Z` }));
    render(<AiNarrativePanel entries={same} from="2026-08-01" to="2026-08-07" />);

    expect(await screen.findByText(/All 3 check-ins in this range recorded the same thing: 4\/10/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('shows a gate the server returns instead of a narrative', async () => {
    const fetchMock = vi.fn((url: string) => url === '/api/ai-provider-info'
      ? Promise.resolve({ ok: true, json: async () => readyProviderInfo })
      : Promise.resolve({ ok: true, json: async () => ({ gate: { reason: 'too-few-entries', message: 'Server says too few.' } }) }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<AiNarrativePanel entries={threeEntries} from="2026-08-01" to="2026-08-07" />);

    await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeDisabled());
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Generate narrative' }));
    expect(await screen.findByText('Server says too few.')).toBeInTheDocument();
  });

  it('renders the narrative\'s bold labels and bullets, never raw markers or links', async () => {
    stubFetch({ narrative: '**Change over time:** rose.\n\n- one\n- two\n\n[link](https://example.com)' });
    const user = userEvent.setup();
    const { container } = render(<AiNarrativePanel entries={threeEntries} from="2026-08-01" to="2026-08-07" />);

    await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeDisabled());
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Generate narrative' }));
    expect(await screen.findByText('Change over time:')).toBeInTheDocument();
    const result = container.querySelector('.ai-result')!;
    expect(result.querySelectorAll('li')).toHaveLength(2);
    expect(result.querySelector('a')).toBeNull();
    expect(result.textContent).not.toContain('**');
  });

  it('drops a previous sample and error when the range changes to one that is gated', async () => {
    const fetchMock = vi.fn((url: string) => url === '/api/ai-provider-info'
      ? Promise.resolve({ ok: true, json: async () => readyProviderInfo })
      : Promise.resolve({ ok: false, json: async () => ({ error: 'Passphrase required.' }) }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const { rerender } = render(<AiNarrativePanel entries={threeEntries} from="2026-08-01" to="2026-08-07" />);

    await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeDisabled());
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Generate narrative' }));
    expect(await screen.findByText(/Pre-written example/)).toBeInTheDocument();

    rerender(<AiNarrativePanel entries={threeEntries.slice(0, 1)} from="2026-08-01" to="2026-08-01" />);
    expect(await screen.findByText('Not AI-generated')).toBeInTheDocument();
    expect(screen.queryByText(/Pre-written example/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear and revoke' })).not.toBeInTheDocument();
  });
});
