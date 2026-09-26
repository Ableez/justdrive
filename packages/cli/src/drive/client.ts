import { google, drive_v3 } from 'googleapis';
import { loadAuth, updateTokens } from '../auth/tokens.js';
import { toAuthError } from '../auth/errors.js';
import { AuthError, OAuthTokens } from '@juststore/shared';
import { loadCredentials } from '../config/credentials.js';

export type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

// Refresh a little early so a request never goes out with a token that
// expires mid-flight.
const EXPIRY_SKEW_MS = 60_000;

let driveClient: drive_v3.Drive | null = null;

export async function createOAuth2Client(redirectUri?: string): Promise<OAuth2Client> {
  const { clientId, clientSecret } = await loadCredentials();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function getAuthenticatedClient(): Promise<OAuth2Client> {
  const auth = await loadAuth();
  if (!auth) {
    throw new AuthError('Not authenticated. Run: justdrive auth login');
  }

  const creds = await loadCredentials();
  if (auth.clientId && auth.clientId !== creds.clientId) {
    throw new AuthError(
      'Your saved login was issued to a different OAuth client than the one now configured.\n' +
        'Run: justdrive auth login',
    );
  }

  const client = await createOAuth2Client();
  client.setCredentials(auth.tokens);

  // google-auth-library refreshes access tokens on its own; persist whatever
  // it gets so long-running processes (the dashboard) survive restarts.
  client.on('tokens', (tokens) => {
    updateTokens(tokens as OAuthTokens).catch(() => {});
  });

  if (isExpired(auth.tokens)) {
    if (!auth.tokens.refresh_token) {
      throw new AuthError('Session expired and no refresh token is saved. Run: justdrive auth login');
    }
    try {
      await client.getAccessToken();
      await updateTokens(client.credentials as OAuthTokens);
    } catch (error) {
      throw toAuthError(error) ?? new AuthError('Failed to refresh your Google session. Run: justdrive auth login');
    }
  }

  return client;
}

function isExpired(tokens: OAuthTokens): boolean {
  if (!tokens.access_token) return true;
  return Boolean(tokens.expiry_date && tokens.expiry_date - EXPIRY_SKEW_MS < Date.now());
}

export async function getDriveClient(): Promise<drive_v3.Drive> {
  if (driveClient) return driveClient;

  const auth = await getAuthenticatedClient();
  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

/** Works with any Drive scope, unlike the People API which needs profile scopes. */
export async function fetchAccountEmail(auth: OAuth2Client): Promise<string | null> {
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.about.get({ fields: 'user(emailAddress)' });
  return res.data.user?.emailAddress ?? null;
}

export async function getUserEmail(): Promise<string | null> {
  try {
    return await fetchAccountEmail(await getAuthenticatedClient());
  } catch {
    return null;
  }
}

export function resetDriveClient(): void {
  driveClient = null;
}
