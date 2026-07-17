import { describe, it, expect } from 'vitest';
import {
  JUSTSTORE_ROOT_FOLDER,
  DEFAULT_PORT,
  MAX_PORT_ATTEMPTS,
  CONFIG_DIR,
  TOKEN_FILE,
  CACHE_FILE,
  ACTIVITY_LOG_FILE,
  DRIVE_SCOPE,
  DRIVE_FIELDS,
} from './constants.js';

describe('constants', () => {
  it('JUSTSTORE_ROOT_FOLDER is "juststore"', () => {
    expect(JUSTSTORE_ROOT_FOLDER).toBe('juststore');
  });

  it('DEFAULT_PORT is 4000', () => {
    expect(DEFAULT_PORT).toBe(4000);
  });

  it('MAX_PORT_ATTEMPTS is 100', () => {
    expect(MAX_PORT_ATTEMPTS).toBe(100);
  });

  it('CONFIG_DIR is ".juststore"', () => {
    expect(CONFIG_DIR).toBe('.juststore');
  });

  it('TOKEN_FILE is "token.json"', () => {
    expect(TOKEN_FILE).toBe('token.json');
  });

  it('CACHE_FILE is "cache.json"', () => {
    expect(CACHE_FILE).toBe('cache.json');
  });

  it('ACTIVITY_LOG_FILE is "activity.json"', () => {
    expect(ACTIVITY_LOG_FILE).toBe('activity.json');
  });

  it('DRIVE_SCOPE is the full Google Drive scope', () => {
    expect(DRIVE_SCOPE).toBe('https://www.googleapis.com/auth/drive');
  });

  it('DRIVE_FIELDS includes all expected fields', () => {
    const expectedFields = [
      'id', 'name', 'mimeType', 'size', 'modifiedTime',
      'createdTime', 'thumbnailLink', 'webViewLink',
      'parents', 'shared', 'trashed',
    ];
    for (const field of expectedFields) {
      expect(DRIVE_FIELDS).toContain(field);
    }
  });

  it('all constants are readonly primitives', () => {
    expect(typeof JUSTSTORE_ROOT_FOLDER).toBe('string');
    expect(typeof DEFAULT_PORT).toBe('number');
    expect(typeof MAX_PORT_ATTEMPTS).toBe('number');
    expect(typeof CONFIG_DIR).toBe('string');
    expect(typeof TOKEN_FILE).toBe('string');
    expect(typeof CACHE_FILE).toBe('string');
    expect(typeof ACTIVITY_LOG_FILE).toBe('string');
    expect(typeof DRIVE_SCOPE).toBe('string');
    expect(typeof DRIVE_FIELDS).toBe('string');
  });
});
