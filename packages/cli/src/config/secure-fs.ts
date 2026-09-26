import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { CONFIG_DIR } from '@juststore/shared';

export function getConfigDir(): string {
  return path.join(os.homedir(), CONFIG_DIR);
}

export async function ensureConfigDir(): Promise<string> {
  const dir = getConfigDir();
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  // mkdir's mode is ignored when the directory already exists (older installs
  // created it world-readable), so tighten it explicitly. No-op on Windows.
  await fs.chmod(dir, 0o700).catch(() => {});
  return dir;
}

/**
 * Write a file readable only by the current user. Writes to a temp file first
 * and renames it into place so a crash never leaves a half-written secret.
 */
export async function writeSecureFile(filePath: string, contents: string): Promise<void> {
  await ensureConfigDir();
  const tmpPath = `${filePath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    await fs.writeFile(tmpPath, contents, { mode: 0o600 });
    await fs.rename(tmpPath, filePath);
    await fs.chmod(filePath, 0o600).catch(() => {});
  } catch (error) {
    await fs.rm(tmpPath, { force: true });
    throw error;
  }
}
