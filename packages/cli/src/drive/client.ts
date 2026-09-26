import { google, drive_v3 } from 'googleapis';
import { fetchDriveToken } from '../api/client.js';

let driveClient: drive_v3.Drive | null = null;

export async function getDriveClient(): Promise<drive_v3.Drive> {
  if (driveClient) return driveClient;

  // No client id or secret: googleapis only needs a way to get a token, and the
  // justdrive server is that way. It hands out Google tokens scoped to the
  // signed-in user without ever giving the machine a long-lived grant.
  //
  // forceRefreshOnFailure arms the library's own 401/403 recovery, which
  // otherwise stays off because there is no refresh_token on the credentials.
  const client = new google.auth.OAuth2({ forceRefreshOnFailure: true });
  client.refreshHandler = async () => {
    const token = await fetchDriveToken();
    return { access_token: token.access_token, expiry_date: token.expiry_date };
  };

  driveClient = google.drive({ version: 'v3', auth: client });
  return driveClient;
}

export function resetDriveClient(): void {
  driveClient = null;
}
