import fs from 'fs/promises';
import path from 'path';
import { AuthError, TOKEN_FILE, OAuthTokens, StoredAuth } from '@juststore/shared';
import { getConfigDir, writeSecureFile } from '../config/secure-fs.js';

export function getTokenPath(): string {
  return path.join(getConfigDir(), TOKEN_FILE);
}

export async function loadAuth(): Promise<StoredAuth | null> {
  let raw: string;
  try {
    raw = await fs.readFile(getTokenPath(), 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new AuthError(`Saved login at ${getTokenPath()} is corrupted. Run: justdrive auth login`);
  }

  const stored = data as Partial<StoredAuth>;
  if (stored?.version === 1 && stored.tokens) {
    return stored as StoredAuth;
  }

  // Pre-0.2 installs stored the bare token object with no client or account info.
  const legacy = data as OAuthTokens;
  return {
    version: 1,
    clientId: '',
    scopes: legacy.scope ? legacy.scope.split(' ') : [],
    tokens: legacy,
  };
}

export async function saveAuth(auth: StoredAuth): Promise<void> {
  await writeSecureFile(getTokenPath(), JSON.stringify(auth, null, 2));
}

/**
 * Merge refreshed tokens into the saved login. Google omits refresh_token on
 * refresh responses, so only overwrite fields that are actually present.
 */
export async function updateTokens(tokens: Partial<OAuthTokens>): Promise<void> {
  const auth = await loadAuth();
  if (!auth) return;

  const present = Object.fromEntries(
    Object.entries(tokens).filter(([, value]) => value !== undefined && value !== null),
  );
  await saveAuth({ ...auth, tokens: { ...auth.tokens, ...present } });
}

export async function loadTokens(): Promise<OAuthTokens | null> {
  return (await loadAuth())?.tokens ?? null;
}

export async function clearTokens(): Promise<void> {
  await fs.rm(getTokenPath(), { force: true });
}
