import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deletePainEntry, listPainEntries, savePainEntry } from '../shared/data/database';
import {
  buildDemoEntries, getSeededDemoIds, hasDemoDataDecisionBeenMade,
  recordDemoCleared, recordDemoSeeded
} from '../shared/data/demoData';
import { createPainEntry } from '../shared/data/painEntry';
import { App } from './App';

vi.mock('../shared/data/database', () => ({
  deletePainEntry: vi.fn().mockResolvedValue(undefined),
  listPainEntries: vi.fn().mockResolvedValue([]),
  mergePainEntries: vi.fn().mockImplementation(async (entries) => entries),
  savePainEntry: vi.fn().mockResolvedValue(undefined)
}));

// Seeding is covered by its own describe block below with the real
// buildDemoEntries/recordDemoSeeded; every other test in this file treats
// demo data as "already decided" so an empty mocked database renders as
// a genuinely empty, unseeded Today screen.
vi.mock('../shared/data/demoData', () => ({
  buildDemoEntries: vi.fn().mockReturnValue([]),
  getSeededDemoIds: vi.fn().mockReturnValue([]),
  hasDemoDataDecisionBeenMade: vi.fn().mockReturnValue(true),
  recordDemoCleared: vi.fn(),
  recordDemoSeeded: vi.fn()
}));

describe('App', () => {
  let intersectionCallback: IntersectionObserverCallback;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    vi.mocked(listPainEntries).mockResolvedValue([]);
    vi.mocked(savePainEntry).mockClear();
    vi.mocked(deletePainEntry).mockClear();
    vi.mocked(buildDemoEntries).mockReset().mockReturnValue([]);
    vi.mocked(getSeededDemoIds).mockReset().mockReturnValue([]);
    vi.mocked(recordDemoSeeded).mockClear();
    vi.mocked(recordDemoCleared).mockClear();
    vi.mocked(hasDemoDataDecisionBeenMade).mockReturnValue(true);
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

  it('requests persistent storage only after the first successful save, never on mount', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    const originalStorage = Object.getOwnPropertyDescriptor(navigator, 'storage');
    Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true });

    try {
      await renderApp();
      expect(persist).not.toHaveBeenCalled();

      const user = await beginCheckIn();
      await user.click(screen.getByRole('button', { name: 'Left lower back' }));
      fireEvent.change(screen.getByRole('slider', { name: 'Pain intensity' }), { target: { value: '6' } });
      await user.click(screen.getByRole('button', { name: 'Save check-in' }));

      await waitFor(() => expect(persist).toHaveBeenCalledOnce());
    } finally {
      if (originalStorage) Object.defineProperty(navigator, 'storage', originalStorage);
      else delete (navigator as { storage?: unknown }).storage;
    }
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

  it('seeds demo entries on first load, but only when storage is empty and no decision has been recorded yet', async () => {
    const demoEntry = createPainEntry({ regions: ['choir-b23'], intensity: 6, occurredAt: '2026-10-01T09:00:00.000Z' });
    vi.mocked(hasDemoDataDecisionBeenMade).mockReturnValue(false);
    vi.mocked(buildDemoEntries).mockReturnValue([demoEntry]);

    await renderApp();

    await waitFor(() => expect(savePainEntry).toHaveBeenCalledWith(demoEntry));
    await screen.findByText('These are sample check-ins so you can see how Tender works.');
    expect(recordDemoSeeded).toHaveBeenCalledWith([demoEntry.id]);
  });

  it('shows the newest seeded sample as the most recent check-in', async () => {
    const older = createPainEntry({ regions: ['choir-b23'], intensity: 3, occurredAt: '2026-10-01T09:00:00.000Z' });
    const newer = createPainEntry({ regions: ['choir-b23'], intensity: 8, occurredAt: '2026-10-05T09:00:00.000Z' });
    vi.mocked(hasDemoDataDecisionBeenMade).mockReturnValue(false);
    vi.mocked(buildDemoEntries).mockReturnValue([older, newer]);

    await renderApp();

    expect(await screen.findByText('8/10')).toBeInTheDocument();
    expect(screen.queryByText('3/10')).not.toBeInTheDocument();
  });

  it('does not seed demo entries when a decision has already been recorded, even if storage is empty', async () => {
    vi.mocked(hasDemoDataDecisionBeenMade).mockReturnValue(true);

    await renderApp();

    expect(buildDemoEntries).not.toHaveBeenCalled();
    expect(savePainEntry).not.toHaveBeenCalled();
    expect(screen.queryByText(/sample check-ins/)).not.toBeInTheDocument();
  });

  it('clears exactly the seeded demo entries, and records that decision, when the visitor asks', async () => {
    const demoEntry = createPainEntry({ regions: ['choir-b23'], intensity: 6, occurredAt: '2026-10-01T09:00:00.000Z' });
    vi.mocked(listPainEntries).mockResolvedValue([demoEntry]);
    vi.mocked(getSeededDemoIds).mockReturnValue([demoEntry.id]);

    await renderApp();
    const user = userEvent.setup();
    await screen.findByText('These are sample check-ins so you can see how Tender works.');
    await user.click(screen.getByRole('button', { name: 'Clear sample data' }));

    await waitFor(() => expect(deletePainEntry).toHaveBeenCalledWith(demoEntry.id));
    await waitFor(() => expect(screen.queryByText(/sample check-ins/)).not.toBeInTheDocument());
    expect(recordDemoCleared).toHaveBeenCalledOnce();
  });
});
