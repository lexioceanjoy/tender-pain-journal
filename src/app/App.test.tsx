import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('identifies Tender as the application', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Tender' })).toBeInTheDocument();
    expect(screen.getByLabelText('When did this happen?')).toHaveAttribute('type', 'datetime-local');
  });

  it('allows a person to select a body region', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Left lower back' }));
    expect(screen.getByText('Left lower back')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save check-in' })).toBeEnabled();
  });

  it('offers optional area-specific detail only when several areas are selected', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.queryByText('Do any areas feel different?')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Left lower back' }));
    await user.click(screen.getByRole('button', { name: 'Left bottom of foot' }));
    expect(screen.getByText('Do any areas feel different?')).toBeInTheDocument();
  });

  it('keeps upper and lower body areas reachable through explicit focus controls', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('button', { name: 'Left back of shoulder' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Left bottom of foot' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Lower body' }));
    expect(screen.getByRole('group', { name: 'back body map, lower view' })).toBeInTheDocument();
  });

  it('offers a visual SI-joint refinement after a relevant broad selection', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.queryByText('Refine lower back, hip or glute')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Left buttock' }));
    await user.click(screen.getByText('Refine lower back, hip or glute'));
    expect(screen.getByRole('button', { name: 'Right SI-joint area' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('button', { name: 'Left SI-joint area' }));
    expect(screen.getByText('Left SI-joint area')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Left buttock, selected' }));
    expect(screen.queryByText('Refine lower back, hip or glute')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Left buttock' }));
    await user.click(screen.getByText('Refine lower back, hip or glute'));
    expect(screen.getByText('No refined locations selected.')).toBeInTheDocument();
  });

  it('opens the urgent symptoms safety message', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Urgent symptoms? Get help now' }));
    expect(screen.getByRole('heading', { name: 'When to get urgent help' })).toBeInTheDocument();
    expect(screen.getByText('This is not a complete list.')).toBeInTheDocument();
  });
});
