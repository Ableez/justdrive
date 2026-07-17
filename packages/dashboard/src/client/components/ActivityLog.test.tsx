import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ActivityLog } from './ActivityLog';
import * as api from '../api/client';

vi.mock('../api/client', () => ({
  fetchActivity: vi.fn(),
}));

describe('ActivityLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    vi.mocked(api.fetchActivity).mockReturnValue(new Promise(() => {}));
    render(<ActivityLog />);
    expect(screen.getByText('Loading activity...')).toBeInTheDocument();
  });

  it('shows empty state', async () => {
    vi.mocked(api.fetchActivity).mockResolvedValue([]);
    render(<ActivityLog />);

    await waitFor(() => {
      expect(screen.getByText('No activity yet.')).toBeInTheDocument();
    });
  });

  it('shows error state', async () => {
    vi.mocked(api.fetchActivity).mockRejectedValue(new Error('Network error'));
    render(<ActivityLog />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Error: Network error');
    });
  });

  it('renders activity entries', async () => {
    const entries = [
      {
        timestamp: '2024-01-01T00:00:00Z',
        operation: 'upload' as const,
        path: '/test.txt',
        status: 'success' as const,
      },
      {
        timestamp: '2024-01-02T00:00:00Z',
        operation: 'download' as const,
        path: '/doc.pdf',
        status: 'success' as const,
        detail: 'from shared link',
      },
    ];
    vi.mocked(api.fetchActivity).mockResolvedValue(entries);
    render(<ActivityLog />);

    await waitFor(() => {
      expect(screen.getByText('Activity Log')).toBeInTheDocument();
      expect(screen.getByText(/upload.*\/test\.txt.*success/)).toBeInTheDocument();
      expect(screen.getByText(/download.*\/doc\.pdf.*success.*from shared link/)).toBeInTheDocument();
    });
  });
});
