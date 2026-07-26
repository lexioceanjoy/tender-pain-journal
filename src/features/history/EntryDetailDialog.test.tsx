import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createPainEntry } from '../../shared/data/painEntry';
import { EntryDetailDialog } from './EntryDetailDialog';

describe('EntryDetailDialog', () => {
  const entry = createPainEntry({
    regions: ['choir-b23'],
    intensity: 6,
    sensations: ['aching'],
    precisionAreas: ['tender-detail-si-left'],
    activities: ['Walking'],
    medication: { name: 'Ibuprofen', dose: '200 mg', perceivedEffect: 'helped' },
    note: 'More noticeable after lunch.'
  });

  it('shows the saved detail and offers editing', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(
      <EntryDetailDialog
        entry={entry}
        confirmingDelete={false}
        onConfirmingDeleteChange={vi.fn()}
        onClose={vi.fn()}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Left buttock')).toBeInTheDocument();
    expect(screen.getByText('Left SI-joint area')).toBeInTheDocument();
    expect(screen.getByText('More noticeable after lunch.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit check-in' }));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('requires a second confirmation before deletion', async () => {
    const setConfirming = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <EntryDetailDialog
        entry={entry}
        confirmingDelete={false}
        onConfirmingDeleteChange={setConfirming}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(setConfirming).toHaveBeenCalledWith(true);
    expect(onDelete).not.toHaveBeenCalled();

    rerender(
      <EntryDetailDialog
        entry={entry}
        confirmingDelete
        onConfirmingDeleteChange={setConfirming}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
