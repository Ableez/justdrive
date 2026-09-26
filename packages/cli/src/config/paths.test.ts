import { describe, expect, it } from 'vitest';
import { normalizePath } from '@juststore/shared';
import { getConfigDir, getCredentialsPath, getOutboxPath } from './paths.js';

describe('config paths', () => {
  it('lives under the XDG config directory by default', () => {
    const previous = process.env.JUSTDRIVE_CONFIG_DIR;
    delete process.env.JUSTDRIVE_CONFIG_DIR;

    expect(getConfigDir()).toMatch(/\.config\/justdrive$/);
    expect(getCredentialsPath()).toMatch(/\.config\/justdrive\/credentials\.json$/);
    expect(getOutboxPath()).toMatch(/\.config\/justdrive\/outbox\.json$/);

    if (previous) process.env.JUSTDRIVE_CONFIG_DIR = previous;
  });

  it('honours an override, which keeps tests off the real home directory', () => {
    process.env.JUSTDRIVE_CONFIG_DIR = '/tmp/justdrive-test';
    expect(getCredentialsPath()).toBe('/tmp/justdrive-test/credentials.json');
    delete process.env.JUSTDRIVE_CONFIG_DIR;
  });
});

describe('re-exported normalizePath', () => {
  it('is available to the CLI', () => {
    expect(normalizePath('juststore/a/b')).toBe('a/b');
  });
});
