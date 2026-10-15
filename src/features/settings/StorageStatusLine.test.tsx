import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StorageStatusLine } from './StorageStatusLine';
import { getStoredPersistenceStatus, readStorageEstimate } from '../../shared/storage/persistentStorage';

vi.mock('../../shared/storage/persistentStorage', () => ({
  getStoredPersistenceStatus: vi.fn(),
  readStorageEstimate: vi.fn()
}));

describe('StorageStatusLine', () => {
  it('renders nothing before any check-in has triggered a request', () => {
    vi.mocked(getStoredPersistenceStatus).mockReturnValue(null);
    vi.mocked(readStorageEstimate).mockResolvedValue({});

    const { container } = render(<StorageStatusLine />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not claim data is protected when persist() was denied', async () => {
    vi.mocked(getStoredPersistenceStatus).mockReturnValue('denied');
    vi.mocked(readStorageEstimate).mockResolvedValue({});

    render(<StorageStatusLine />);
    const line = await screen.findByText(/did not grant persistent storage/);
    expect(line.textContent?.toLowerCase()).not.toMatch(/protect|safe|guarantee/);
    expect(line.textContent).toMatch(/may clear them automatically/);
  });

  it('still discloses that clearing site data deletes check-ins even when granted', async () => {
    vi.mocked(getStoredPersistenceStatus).mockReturnValue('granted');
    vi.mocked(readStorageEstimate).mockResolvedValue({});

    render(<StorageStatusLine />);
    const line = await screen.findByText(/has granted persistent storage/);
    expect(line.textContent).toMatch(/clearing this site.s data.*will still delete them/i);
  });

  it('renders unsupported copy without throwing when the API is absent', async () => {
    vi.mocked(getStoredPersistenceStatus).mockReturnValue('unsupported');
    vi.mocked(readStorageEstimate).mockResolvedValue({});

    render(<StorageStatusLine />);
    await screen.findByText(/doesn.t support requesting persistent storage/);
  });

  it('shows usage/quota only once both are meaningful numbers', async () => {
    vi.mocked(getStoredPersistenceStatus).mockReturnValue('granted');
    vi.mocked(readStorageEstimate).mockResolvedValue({ usageBytes: 2 * 1024 * 1024, quotaBytes: 500 * 1024 * 1024 });

    render(<StorageStatusLine />);
    await waitFor(() => expect(screen.getByText(/Using about/)).toBeInTheDocument());
  });

  it('omits the usage/quota sentence when the estimate is unavailable', async () => {
    vi.mocked(getStoredPersistenceStatus).mockReturnValue('granted');
    vi.mocked(readStorageEstimate).mockResolvedValue({});

    render(<StorageStatusLine />);
    await screen.findByText(/has granted persistent storage/);
    expect(screen.queryByText(/Using about/)).not.toBeInTheDocument();
  });
});
