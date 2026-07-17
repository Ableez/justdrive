import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

vi.mock('./components/ActivityLog', () => ({
  ActivityLog: () => <div data-testid="activity-log">ActivityLog</div>,
}));

vi.mock('./components/FileBrowser', () => ({
  FileBrowser: () => <div data-testid="file-browser">FileBrowser</div>,
}));

vi.mock('./components/UploadForm', () => ({
  UploadForm: () => <div data-testid="upload-form">UploadForm</div>,
}));

vi.mock('./components/AuthStatus', () => ({
  AuthStatus: () => <div data-testid="auth-status">AuthStatus</div>,
}));

describe('App', () => {
  it('renders the heading', () => {
    render(<App />);
    expect(screen.getByText('juststore dashboard')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(<App />);
    expect(screen.getByText('Activity')).toHaveAttribute('href', '/');
    expect(screen.getByText('Files')).toHaveAttribute('href', '/files');
    expect(screen.getByText('Upload')).toHaveAttribute('href', '/upload');
    expect(screen.getByText('Auth')).toHaveAttribute('href', '/auth');
  });

  it('renders all components', () => {
    render(<App />);
    expect(screen.getByTestId('activity-log')).toBeInTheDocument();
    expect(screen.getByTestId('file-browser')).toBeInTheDocument();
    expect(screen.getByTestId('upload-form')).toBeInTheDocument();
    expect(screen.getByTestId('auth-status')).toBeInTheDocument();
  });
});
