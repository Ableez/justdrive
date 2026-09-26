import os from 'os';
import path from 'path';

const CONFIG_DIR = '.config/justdrive';
const CREDENTIALS_FILE = 'credentials.json';
const OUTBOX_FILE = 'outbox.json';

export function getConfigDir(): string {
  if (process.env.JUSTDRIVE_CONFIG_DIR) return process.env.JUSTDRIVE_CONFIG_DIR;
  return path.join(os.homedir(), CONFIG_DIR);
}

export function getCredentialsPath(): string {
  return path.join(getConfigDir(), CREDENTIALS_FILE);
}

export function getOutboxPath(): string {
  return path.join(getConfigDir(), OUTBOX_FILE);
}
