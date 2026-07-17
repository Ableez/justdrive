import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { CONFIG_DIR, TOKEN_FILE, OAuthTokens } from '@juststore/shared';

function getTokenPath(): string {
  return path.join(os.homedir(), CONFIG_DIR, TOKEN_FILE);
}

export async function saveTokens(tokens: Partial<OAuthTokens>): Promise<void> {
  const tokenPath = getTokenPath();
  await fs.mkdir(path.dirname(tokenPath), { recursive: true });
  await fs.writeFile(tokenPath, JSON.stringify(tokens, null, 2));
}

export async function loadTokens(): Promise<OAuthTokens | null> {
  try {
    const raw = await fs.readFile(getTokenPath(), 'utf-8');
    return JSON.parse(raw);
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function clearTokens(): Promise<void> {
  try {
    await fs.unlink(getTokenPath());
  } catch {
    // File may not exist
  }
}
