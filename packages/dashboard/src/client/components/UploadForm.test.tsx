import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { UploadForm } from './UploadForm';
import * as api from '../api/client';

vi.mock('../api/client', () => ({
  uploadFile: vi.fn(),
}));

describe('UploadForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form with file input and submit button', () => {
    render(<UploadForm />);
    expect(screen.getByRole('heading', { name: 'Upload' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeInTheDocument();
  });

  it('shows error when submitting without file', async () => {
    render(<UploadForm />);
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Please select a file');
    });
  });

  it('shows uploading state during upload', async () => {
    vi.mocked(api.uploadFile).mockReturnValue(new Promise(() => {}));
    render(<UploadForm />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Uploading...' })).toBeDisabled();
    });
  });

  it('shows success after upload completes', async () => {
    vi.mocked(api.uploadFile).mockResolvedValue({ id: '1', name: 'test.txt' } as never);
    render(<UploadForm />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(screen.getByText('Upload complete!')).toBeInTheDocument();
    });
  });

  it('shows error on upload failure', async () => {
    vi.mocked(api.uploadFile).mockRejectedValue(new Error('Server error'));
    render(<UploadForm />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error');
    });
  });
});
