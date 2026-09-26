import { google, drive_v3 } from 'googleapis';
import { fetchDriveToken } from '../api/client.js';

let driveClient: drive_v3.Drive | null = null;

export async function getDriveClient(): Promise<drive_v3.Drive> {
  if (driveClient) return driveClient;

  // No client id or secret: googleapis only needs a way to get a token, and the
  // justdrive server is that way. It hands out Google tokens scoped to the
  // signed-in user without ever giving the machine a long-lived grant.
  const client = new google.auth.OAuth2();
  client.refreshHandler = async () => {
    const token = await fetchDriveToken();
    client.setCredentials({ access_token: token.access_token, expiry_date: token.expiry_date });
    return { access_token: token.access_token, expiry_date: token.expiry_date };
  };

  driveClient = google.drive({ version: 'v3', auth: client });
  return driveClient;
}

export function resetDriveClient(): void {
  driveClient = null;
}
