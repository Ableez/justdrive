import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FileBrowser } from './FileBrowser';
import * as api from '../api/client';

vi.mock('../api/client', () => ({
  fetchFiles: vi.fn(),
  deleteFile: vi.fn(),
}));

describe('FileBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    vi.mocked(api.fetchFiles).mockReturnValue(new Promise(() => {}));
    render(<FileBrowser />);
    expect(screen.getByText('Loading files...')).toBeInTheDocument();
  });

  it('shows empty state', async () => {
    vi.mocked(api.fetchFiles).mockResolvedValue([]);
    render(<FileBrowser />);

    await waitFor(() => {
      expect(screen.getByText('No files found.')).toBeInTheDocument();
    });
  });

  it('shows error state', async () => {
    vi.mocked(api.fetchFiles).mockRejectedValue(new Error('API error'));
    render(<FileBrowser />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Error: API error');
    });
  });

  it('renders file list with correct data', async () => {
    const files = [
      {
        id: '1',
        name: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: '2048',
      },
      {
        id: '2',
        name: 'docs',
        mimeType: 'application/vnd.google-apps.folder',
        size: null,
      },
    ];
    vi.mocked(api.fetchFiles).mockResolvedValue(files as never);
    render(<FileBrowser />);

    await waitFor(() => {
      expect(screen.getByText('Files')).toBeInTheDocument();
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
      expect(screen.getByText('jpeg')).toBeInTheDocument();
      expect(screen.getByText('2048')).toBeInTheDocument();
      expect(screen.getByText('docs')).toBeInTheDocument();
      expect(screen.getByText('folder')).toBeInTheDocument();
    });
  });
});
