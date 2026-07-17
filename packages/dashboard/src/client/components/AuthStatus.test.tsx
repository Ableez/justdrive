import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthStatus } from './AuthStatus';
import * as api from '../api/client';

vi.mock('../api/client', () => ({
  fetchStatus: vi.fn(),
}));

describe('AuthStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    vi.mocked(api.fetchStatus).mockReturnValue(new Promise(() => {}));
    render(<AuthStatus />);
    expect(screen.getByText('Checking auth...')).toBeInTheDocument();
  });

  it('shows authenticated state with email', async () => {
    vi.mocked(api.fetchStatus).mockResolvedValue({
      authenticated: true,
      email: 'user@test.com',
    });
    render(<AuthStatus />);

    await waitFor(() => {
      expect(screen.getByText('Authenticated')).toBeInTheDocument();
      expect(screen.getByText('as user@test.com')).toBeInTheDocument();
    });
  });

  it('shows authenticated state without email', async () => {
    vi.mocked(api.fetchStatus).mockResolvedValue({
      authenticated: true,
    });
    render(<AuthStatus />);

    await waitFor(() => {
      expect(screen.getByText('Authenticated')).toBeInTheDocument();
    });
  });

  it('shows unauthenticated state', async () => {
    vi.mocked(api.fetchStatus).mockResolvedValue({
      authenticated: false,
    });
    render(<AuthStatus />);

    await waitFor(() => {
      expect(screen.getByText(/Not authenticated/)).toBeInTheDocument();
    });
  });

  it('shows unauthenticated on fetch error', async () => {
    vi.mocked(api.fetchStatus).mockRejectedValue(new Error('Network error'));
    render(<AuthStatus />);

    await waitFor(() => {
      expect(screen.getByText(/Not authenticated/)).toBeInTheDocument();
    });
  });
});
