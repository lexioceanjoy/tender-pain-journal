import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPainEntry } from '../../shared/data/painEntry';
import { AiNarrativePanel } from './AiNarrativePanel';

describe('AI narrative consent', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not send records before consent and can clear the local result', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ narrative: 'Pain was recorded most often in the left buttock.' })
    });
    vi.stubGlobal('fetch', fetchMock);
    const entry = createPainEntry({ regions: ['choir-b23'], intensity: 7 });
    const user = userEvent.setup();
    render(<AiNarrativePanel entries={[entry]} from="2026-08-01" to="2026-08-07" />);

    expect(screen.getByRole('button', { name: 'Generate narrative' })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Generate narrative' }));
    await waitFor(() => expect(screen.getByText(/Pain was recorded most often/)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Clear and revoke' }));
    expect(screen.queryByText(/Pain was recorded most often/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate narrative' })).toBeDisabled();
  });
});
