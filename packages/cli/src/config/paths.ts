import os from 'os';
import path from 'path';

const CONFIG_DIR = 'justdrive';
const CREDENTIALS_FILE = 'credentials.json';
const OUTBOX_FILE = 'outbox.json';

/** os.homedir() throws when HOME is unset, which is normal inside a container. */
function homeDirectory(): string {
  if (process.env.HOME) return process.env.HOME;
  try {
    return os.homedir();
  } catch {
    return os.tmpdir();
  }
}

export function getConfigDir(): string {
  if (process.env.JUSTDRIVE_CONFIG_DIR) return process.env.JUSTDRIVE_CONFIG_DIR;
  if (process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, CONFIG_DIR);
  return path.join(homeDirectory(), '.config', CONFIG_DIR);
}

export function getCredentialsPath(): string {
  return path.join(getConfigDir(), CREDENTIALS_FILE);
}

export function getOutboxPath(): string {
  return path.join(getConfigDir(), OUTBOX_FILE);
}
