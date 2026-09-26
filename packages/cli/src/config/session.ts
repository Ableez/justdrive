import fs from 'fs/promises';
import crypto from 'crypto';
import { getConfigDir, getCredentialsPath } from './paths.js';

export interface DeviceSession {
  version: 1;
  apiUrl: string;
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  deviceId: string;
  deviceName: string;
  email?: string;
  rootFolderId?: string;
}

export async function loadSession(): Promise<DeviceSession | null> {
  let raw: string;
  try {
    raw = await fs.readFile(getCredentialsPath(), 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `Saved session at ${getCredentialsPath()} is corrupt. Run: justdrive login`,
    );
  }

  const session = parsed as Partial<DeviceSession>;
  if (session?.version !== 1 || !session.accessToken || !session.refreshToken) {
    throw new Error(`Saved session at ${getCredentialsPath()} is incomplete. Run: justdrive login`);
  }
  return session as DeviceSession;
}

export async function saveSession(session: DeviceSession): Promise<void> {
  const dir = getConfigDir();
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  await fs.chmod(dir, 0o700).catch(() => {});
  const target = getCredentialsPath();
  const temp = `${target}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    await fs.writeFile(temp, JSON.stringify(session, null, 2), { mode: 0o600 });
    await fs.rename(temp, target);
    await fs.chmod(target, 0o600).catch(() => {});
  } catch (error) {
    await fs.rm(temp, { force: true });
    throw error;
  }
}

export async function clearSession(): Promise<void> {
  await fs.rm(getCredentialsPath(), { force: true });
}
