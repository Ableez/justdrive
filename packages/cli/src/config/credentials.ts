import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { AuthError, CLIENT_FILE } from '@juststore/shared';
import { getConfigDir, writeSecureFile } from './secure-fs.js';

// Injected by tsup at build time. Always defined in builds (possibly as ''),
// undefined when running from source under vitest.
declare const __CLIENT_ID__: string;
declare const __CLIENT_SECRET__: string;

export type CredentialsSource = 'env' | 'file' | 'bundled';

export interface ClientCredentials {
  clientId: string;
  // Google issues a secret for Desktop clients but does not treat it as
  // confidential; PKCE is what protects the code exchange.
  clientSecret?: string;
  source: CredentialsSource;
}

export const CONSOLE_CREDENTIALS_URL = 'https://console.cloud.google.com/apis/credentials';
export const CONSOLE_AUDIENCE_URL = 'https://console.cloud.google.com/auth/audience';

let cachedCredentials: ClientCredentials | null = null;

export function getClientFilePath(): string {
  return process.env.JUSTDRIVE_CREDENTIALS_FILE || path.join(getConfigDir(), CLIENT_FILE);
}

/**
 * Resolve the OAuth client in priority order:
 *   1. JUSTDRIVE_CLIENT_ID / JUSTDRIVE_CLIENT_SECRET (or GOOGLE_*) env vars
 *   2. Client JSON imported with `justdrive auth setup` (or JUSTDRIVE_CREDENTIALS_FILE)
 *   3. Client bundled into the published build
 */
export async function loadCredentials(): Promise<ClientCredentials> {
  if (cachedCredentials) return cachedCredentials;

  const resolved = fromEnv() ?? (await fromFile()) ?? fromBuild();
  if (!resolved) {
    throw new AuthError(await missingCredentialsMessage());
  }
  cachedCredentials = resolved;
  return resolved;
}

function fromEnv(): ClientCredentials | null {
  const clientId = process.env.JUSTDRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  const clientSecret = process.env.JUSTDRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  return { clientId, clientSecret: clientSecret || undefined, source: 'env' };
}

async function fromFile(): Promise<ClientCredentials | null> {
  const filePath = getClientFilePath();
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    const explicit = Boolean(process.env.JUSTDRIVE_CREDENTIALS_FILE);
    if (!explicit && (error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new AuthError(`Could not read OAuth client file ${filePath}: ${(error as Error).message}`);
  }
  return { ...parseClientJson(raw, filePath), source: 'file' };
}

function fromBuild(): ClientCredentials | null {
  if (typeof __CLIENT_ID__ === 'undefined' || !__CLIENT_ID__) return null;
  const clientSecret = typeof __CLIENT_SECRET__ === 'undefined' ? '' : __CLIENT_SECRET__;
  return { clientId: __CLIENT_ID__, clientSecret: clientSecret || undefined, source: 'bundled' };
}

export function parseClientJson(
  raw: string,
  origin: string,
): { clientId: string; clientSecret?: string } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new AuthError(`${origin} is not valid JSON.`);
  }

  const record = data as { installed?: Record<string, unknown>; web?: unknown } | null;
  if (record?.web) {
    throw new AuthError(
      `${origin} is a "Web application" OAuth client. justdrive needs a "Desktop app" client.\n` +
        `Create one at ${CONSOLE_CREDENTIALS_URL}`,
    );
  }

  const installed = record?.installed;
  if (!installed || typeof installed.client_id !== 'string' || !installed.client_id) {
    throw new AuthError(`${origin} is not a Google OAuth client file (missing installed.client_id).`);
  }

  return {
    clientId: installed.client_id,
    clientSecret:
      typeof installed.client_secret === 'string' && installed.client_secret
        ? installed.client_secret
        : undefined,
  };
}

/** Validate a downloaded client_secret_*.json and store it in the config dir. */
export async function importCredentialsFile(sourcePath: string): Promise<ClientCredentials> {
  const raw = await fs.readFile(sourcePath, 'utf-8');
  const { clientId, clientSecret } = parseClientJson(raw, sourcePath);
  const normalized = { installed: { client_id: clientId, client_secret: clientSecret } };
  await writeSecureFile(path.join(getConfigDir(), CLIENT_FILE), JSON.stringify(normalized, null, 2));
  resetCredentialsCache();
  return { clientId, clientSecret, source: 'file' };
}

async function missingCredentialsMessage(): Promise<string> {
  const lines = [
    'No Google OAuth client configured.',
    '',
    'Create a "Desktop app" OAuth client and download its JSON:',
    `  ${CONSOLE_CREDENTIALS_URL}`,
    '',
    'Then either:',
    '  justdrive auth setup <path/to/client_secret.json>',
    'or set JUSTDRIVE_CLIENT_ID and JUSTDRIVE_CLIENT_SECRET in your environment.',
  ];

  const downloaded = await findDownloadedClientFile();
  if (downloaded) {
    lines.push('', 'Found a client file in Downloads. To use it, run:', `  justdrive auth setup "${downloaded}"`);
  }
  return lines.join('\n');
}

async function findDownloadedClientFile(): Promise<string | null> {
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  try {
    const files = await fs.readdir(downloadsDir);
    const match = files.find((f) => f.startsWith('client_secret_') && f.endsWith('.json'));
    return match ? path.join(downloadsDir, match) : null;
  } catch {
    return null;
  }
}

export function resetCredentialsCache(): void {
  cachedCredentials = null;
}
