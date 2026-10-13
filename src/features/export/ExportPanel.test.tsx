import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPainEntry } from '../../shared/data/painEntry';
import { ExportPanel } from './ExportPanel';

describe('ExportPanel', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('explains there is nothing to export instead of offering a download of nothing', () => {
    render(<ExportPanel entries={[]} />);

    expect(screen.getByText('There are no check-ins to export yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download JSON' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download CSV' })).not.toBeInTheDocument();
  });

  it('offers JSON and CSV downloads once there are entries, and reports what happened', async () => {
    const entry = createPainEntry({ regions: ['choir-b23'], intensity: 7 });
    const user = userEvent.setup();
    render(<ExportPanel entries={[entry]} />);

    await user.click(screen.getByRole('button', { name: 'Download JSON' }));
    expect(screen.getByRole('status')).toHaveTextContent('1 entry exported as JSON.');

    await user.click(screen.getByRole('button', { name: 'Download CSV' }));
    expect(screen.getByRole('status')).toHaveTextContent('1 entry exported as CSV.');
  });
});
