import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getConfigDir, getCredentialsPath, getOutboxPath } from './paths.js';

const ENV = {
  JUSTDRIVE_CONFIG_DIR: process.env.JUSTDRIVE_CONFIG_DIR,
  XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
  HOME: process.env.HOME,
};

beforeEach(() => {
  delete process.env.JUSTDRIVE_CONFIG_DIR;
  delete process.env.XDG_CONFIG_HOME;
  process.env.HOME = '/home/tester';
});

afterEach(() => {
  for (const [key, value] of Object.entries(ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('config paths', () => {
  it('uses the XDG config directory when one is set', () => {
    process.env.XDG_CONFIG_HOME = '/srv/shared-config';

    expect(getConfigDir()).toBe('/srv/shared-config/justdrive');
    expect(getCredentialsPath()).toBe('/srv/shared-config/justdrive/credentials.json');
  });

  it('falls back to ~/.config', () => {
    expect(getConfigDir()).toBe('/home/tester/.config/justdrive');
    expect(getOutboxPath()).toBe('/home/tester/.config/justdrive/outbox.json');
  });

  it('lets an explicit override win, which keeps tests off the real home', () => {
    process.env.JUSTDRIVE_CONFIG_DIR = '/tmp/justdrive-test';
    process.env.XDG_CONFIG_HOME = '/srv/shared-config';

    expect(getCredentialsPath()).toBe('/tmp/justdrive-test/credentials.json');
  });

  it('still works with no HOME, as in a container started without one', () => {
    delete process.env.HOME;
    expect(getConfigDir()).not.toContain('undefined');
    expect(getConfigDir()).toMatch(/justdrive$/);
  });
});
