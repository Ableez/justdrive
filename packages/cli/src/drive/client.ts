import { google, drive_v3 } from 'googleapis';
import { loadTokens, saveTokens } from '../auth/tokens.js';
import { AuthError } from '@juststore/shared';
import { loadCredentials, getClientId, getClientSecret, getDefaultRedirectUri } from '../config/credentials.js';

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

let driveClient: drive_v3.Drive | null = null;
let oauth2Client: OAuth2Client | null = null;

export async function createOAuth2Client(redirectUri?: string): Promise<OAuth2Client> {
  const creds = await loadCredentials();
  const clientId = getClientId(creds);
  const clientSecret = getClientSecret(creds);
  const redirect = redirectUri || getDefaultRedirectUri(creds);

  oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirect);
  return oauth2Client;
}

export async function getAuthenticatedClient(): Promise<OAuth2Client> {
  const client = await createOAuth2Client();
  const tokens = await loadTokens();

  if (!tokens) {
    throw new AuthError('Not authenticated. Run: juststore auth login');
  }

  client.setCredentials(tokens);

  // Auto-refresh expired tokens
  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    if (!tokens.refresh_token) {
      throw new AuthError('Token expired and no refresh token available. Run: juststore auth login');
    }

    try {
      const { credentials } = await client.refreshAccessToken();
      client.setCredentials(credentials);
      // Persist refreshed tokens
      await saveTokens(credentials);
    } catch {
      throw new AuthError('Failed to refresh token. Run: juststore auth login');
    }
  }

  return client;
}

export async function getDriveClient(): Promise<drive_v3.Drive> {
  if (driveClient) return driveClient;

  const auth = await getAuthenticatedClient();
  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

export async function getUserEmail(): Promise<string | null> {
  try {
    const client = await getAuthenticatedClient();
    const people = google.people({ version: 'v1', auth: client });
    const res = await people.people.get({
      resourceName: 'people/me',
      personFields: 'emailAddresses',
    });
    return res.data.emailAddresses?.[0]?.value || null;
  } catch {
    return null;
  }
}

export function resetDriveClient(): void {
  driveClient = null;
  oauth2Client = null;
}
