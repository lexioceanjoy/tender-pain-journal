import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listPainEntries, savePainEntry } from '../shared/data/database';
import { App } from './App';

vi.mock('../shared/data/database', () => ({
  deletePainEntry: vi.fn().mockResolvedValue(undefined),
  listPainEntries: vi.fn().mockResolvedValue([]),
  mergePainEntries: vi.fn().mockImplementation(async (entries) => entries),
  savePainEntry: vi.fn().mockResolvedValue(undefined)
}));

describe('App', () => {
  let intersectionCallback: IntersectionObserverCallback;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    vi.mocked(listPainEntries).mockResolvedValue([]);
    vi.mocked(savePainEntry).mockClear();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }

      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() { return []; }
      root = null;
      rootMargin = '0px';
      thresholds = [0.15];
    });
  });

  async function renderApp() {
    render(<App />);
    await waitFor(() => expect(listPainEntries).toHaveBeenCalled());
  }

  async function beginCheckIn() {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New check-in' }));
    return user;
  }

  it('opens on a focused Today screen with task navigation', async () => {
    await renderApp();
    expect(screen.getByRole('heading', { name: 'Tender' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'A quick note while it’s fresh.' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
    expect(screen.queryByLabelText('When did this happen?')).not.toBeInTheDocument();
  });

  it('requires a location and deliberate intensity choice, then allows a quick save', async () => {
    await renderApp();
    const user = await beginCheckIn();
    expect(screen.getByLabelText('When did this happen?')).toHaveAttribute('type', 'datetime-local');
    const save = screen.getByRole('button', { name: 'Select a location to continue' });
    expect(save).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Left lower back' }));
    expect(screen.getByText('Left lower back')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose an intensity to continue' })).toBeDisabled();

    fireEvent.change(screen.getByRole('slider', { name: 'Pain intensity' }), { target: { value: '6' } });
    expect(screen.getByRole('button', { name: 'Save check-in' })).toBeEnabled();
    expect(screen.getByText('That’s enough for a useful check-in. Details below are optional.')).toBeInTheDocument();
  });

  it('offers optional area-specific detail only when several areas are selected', async () => {
    await renderApp();
    const user = await beginCheckIn();
    expect(screen.queryByText('Do any areas feel different?')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Left lower back' }));
    await user.click(screen.getByRole('button', { name: 'Left bottom of foot' }));
    expect(screen.getByText('Do any areas feel different?')).toBeInTheDocument();
  });

  it('offers a contextual save action when optional details carry the main save off-screen', async () => {
    await renderApp();
    const user = await beginCheckIn();
    await user.click(screen.getByRole('button', { name: 'Left lower back' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Pain intensity' }), { target: { value: '6' } });

    expect(screen.queryByRole('region', { name: 'Save optional details' })).not.toBeInTheDocument();
    await user.click(screen.getByText('Add context'));
    act(() => intersectionCallback(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver
    ));

    const stickySave = screen.getByRole('region', { name: 'Save optional details' });
    expect(stickySave).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save now' }));
    await waitFor(() => expect(savePainEntry).toHaveBeenCalledOnce());
    expect(screen.getByText('Check-in saved privately on this device.')).toBeInTheDocument();
  });

  it('keeps upper and lower body areas reachable through explicit focus controls', async () => {
    await renderApp();
    const user = await beginCheckIn();
    expect(screen.getByRole('button', { name: 'Left back of shoulder' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Left bottom of foot' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Lower body' }));
    expect(screen.getByRole('group', { name: 'back body map, lower view' })).toBeInTheDocument();
  });

  it('offers a visual SI-joint refinement after a relevant broad selection', async () => {
    await renderApp();
    const user = await beginCheckIn();
    expect(screen.queryByText('Refine lower back, hip or glute')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Left buttock' }));
    await user.click(screen.getByText('Refine lower back, hip or glute'));
    expect(screen.getByRole('button', { name: 'Right SI-joint area' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('button', { name: 'Left SI-joint area' }));
    expect(screen.getByText('Left SI-joint area')).toBeInTheDocument();
  });

  it('moves history, insights, and settings out of the check-in scroll', async () => {
    await renderApp();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'History' }));
    expect(screen.getByRole('heading', { name: 'Your check-ins' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Insights' }));
    expect(screen.getByRole('heading', { name: 'What your records show' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('heading', { name: 'Privacy and support' })).toBeInTheDocument();
  });

  it('opens the urgent symptoms safety message', async () => {
    await renderApp();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Urgent help' }));
    expect(screen.getByRole('heading', { name: 'When to get urgent help' })).toBeInTheDocument();
    expect(screen.getByText(/These examples are not a complete list/)).toBeInTheDocument();
  });
});
