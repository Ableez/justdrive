import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { AuthError } from '@juststore/shared';

declare const __CLIENT_ID__: string;
declare const __CLIENT_SECRET__: string;

interface InstalledCredentials {
  installed: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
    auth_uri: string;
    token_uri: string;
  };
}

const GOOGLE_CONSOLE_URL =
  'https://console.cloud.google.com/apis/credentials/consent?project=juststore-502602';

let cachedCredentials: InstalledCredentials | null = null;

export async function loadCredentials(): Promise<InstalledCredentials> {
  if (cachedCredentials) return cachedCredentials;

  // 1. Runtime env vars (user override in the shell)
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    cachedCredentials = buildCredentials(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost',
    );
    return cachedCredentials;
  }

  // 2. JSON file from Downloads folder
  const credPath = await findCredentialsFile();
  if (credPath) {
    const raw = await fs.readFile(credPath, 'utf-8');
    cachedCredentials = JSON.parse(raw);
    return cachedCredentials;
  }

  // 3. Build-time injected defaults (set by tsup define during npm publish)
  if (typeof __CLIENT_ID__ !== 'undefined' && typeof __CLIENT_SECRET__ !== 'undefined') {
    cachedCredentials = buildCredentials(__CLIENT_ID__, __CLIENT_SECRET__, 'http://localhost');
    return cachedCredentials;
  }

  throw new AuthError(
    'No Google credentials found.\n\n' +
    'To use juststore you need Google Drive API credentials:\n\n' +
    '  Option A: Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env\n' +
    '  Option B: Place the client_secret_*.json file in ~/Downloads/\n\n' +
    'To get credentials, visit:\n' +
    '  https://console.cloud.google.com/apis/credentials',
  );
}

function buildCredentials(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): InstalledCredentials {
  return {
    installed: {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: [redirectUri],
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
    },
  };
}

async function findCredentialsFile(): Promise<string | null> {
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  try {
    const files = await fs.readdir(downloadsDir);
    const credFile = files.find(
      (f) => f.startsWith('client_secret_') && f.endsWith('.json'),
    );
    if (credFile) return path.join(downloadsDir, credFile);
  } catch {
    // Downloads dir may not exist
  }
  return null;
}

export function getClientId(creds: InstalledCredentials): string {
  return creds.installed.client_id;
}

export function getClientSecret(creds: InstalledCredentials): string {
  return creds.installed.client_secret;
}

export function getDefaultRedirectUri(creds: InstalledCredentials): string {
  return creds.installed.redirect_uris?.[0] || 'http://localhost';
}

export function resetCredentialsCache(): void {
  cachedCredentials = null;
}

export function getConsentScreenUrl(): string {
  return GOOGLE_CONSOLE_URL;
}
