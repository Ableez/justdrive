import { describe, it, expect } from 'vitest';
import type { DriveFile, ActivityLogEntry, OAuthTokens, Config } from './types.js';

describe('types', () => {
  it('DriveFile type is exported and usable', () => {
    const file: DriveFile = {
      id: '123',
      name: 'test.txt',
      mimeType: 'text/plain',
    };
    expect(file.id).toBe('123');
    expect(file.name).toBe('test.txt');
    expect(file.mimeType).toBe('text/plain');
  });

  it('DriveFile accepts optional fields', () => {
    const file: DriveFile = {
      id: '123',
      name: 'test.txt',
      mimeType: 'text/plain',
      size: '1024',
      modifiedTime: '2024-01-01T00:00:00Z',
      createdTime: '2024-01-01T00:00:00Z',
      thumbnailLink: 'https://example.com/thumb',
      webViewLink: 'https://example.com/view',
      parents: ['root'],
      shared: false,
      trashed: false,
    };
    expect(file.size).toBe('1024');
    expect(file.shared).toBe(false);
  });

  it('DriveFile allows null optional fields', () => {
    const file: DriveFile = {
      id: '123',
      name: 'test.txt',
      mimeType: 'text/plain',
      size: null,
      modifiedTime: null,
      thumbnailLink: null,
      webViewLink: null,
    };
    expect(file.size).toBeNull();
  });

  it('ActivityLogEntry type is exported and usable', () => {
    const entry: ActivityLogEntry = {
      timestamp: '2024-01-01T00:00:00Z',
      operation: 'upload',
      path: '/test/file.txt',
      status: 'success',
    };
    expect(entry.operation).toBe('upload');
    expect(entry.status).toBe('success');
  });

  it('ActivityLogEntry accepts all operation types', () => {
    const operations: ActivityLogEntry['operation'][] = [
      'upload', 'download', 'mkdir', 'mv', 'rm', 'share', 'login', 'logout',
    ];
    for (const op of operations) {
      const entry: ActivityLogEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        operation: op,
        path: '/test',
        status: 'success',
      };
      expect(entry.operation).toBe(op);
    }
  });

  it('ActivityLogEntry accepts error status with detail', () => {
    const entry: ActivityLogEntry = {
      timestamp: '2024-01-01T00:00:00Z',
      operation: 'upload',
      path: '/test/file.txt',
      status: 'error',
      detail: 'Permission denied',
    };
    expect(entry.status).toBe('error');
    expect(entry.detail).toBe('Permission denied');
  });

  it('OAuthTokens type is exported and usable', () => {
    const tokens: OAuthTokens = {
      access_token: 'at_123',
      refresh_token: 'rt_456',
      expiry_date: Date.now() + 3600000,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/drive',
    };
    expect(tokens.access_token).toBe('at_123');
    expect(tokens.refresh_token).toBe('rt_456');
  });

  it('OAuthTokens allows null fields', () => {
    const tokens: OAuthTokens = {
      access_token: null,
      refresh_token: null,
      expiry_date: null,
      token_type: null,
    };
    expect(tokens.access_token).toBeNull();
  });

  it('Config type is exported and usable', () => {
    const config: Config = {
      rootFolderId: 'folder_123',
      userEmail: 'user@example.com',
    };
    expect(config.rootFolderId).toBe('folder_123');
    expect(config.userEmail).toBe('user@example.com');
  });

  it('Config allows empty object', () => {
    const config: Config = {};
    expect(config.rootFolderId).toBeUndefined();
    expect(config.userEmail).toBeUndefined();
  });
});
