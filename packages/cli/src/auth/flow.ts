import express from 'express';
import open from 'open';
import { saveTokens, clearTokens } from './tokens.js';
import { DEFAULT_PORT, findAvailablePort, AuthError } from '@juststore/shared';
import { logActivity } from '../logger/index.js';
import { createOAuth2Client } from '../drive/client.js';
import { getConsentScreenUrl } from '../config/credentials.js';

export async function runAuthLogin(): Promise<void> {
  const port = await findAvailablePort(DEFAULT_PORT);
  const redirectUri = `http://localhost:${port}/oauth2callback`;

  const oauth2Client = await createOAuth2Client(redirectUri);

  const scope = process.env.GOOGLE_DRIVE_SCOPE || 'https://www.googleapis.com/auth/drive';

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [scope],
    redirect_uri: redirectUri,
  });

  const app = express();

  const tokenPromise = new Promise<void>((resolve, reject) => {
    app.get('/oauth2callback', async (req, res) => {
      const code = req.query.code as string;
      const error = req.query.error as string;

      if (error === 'access_denied') {
        const msg = [
          '<h1>Access Denied</h1>',
          '<p>Google blocked this authentication request.</p>',
          `<p>If you are a developer, go to <a href="${getConsentScreenUrl()}">Google Cloud Console</a>,`,
          'add your email as a <b>Test user</b> under <b>OAuth consent screen</b>, then retry.</p>',
        ].join('\n');
        res.status(403).send(msg);
        reject(new AuthError(
          'Access denied. Add your email as a test user:\n' +
          `  ${getConsentScreenUrl()}`,
        ));
        return;
      }

      if (!code) {
        res.status(400).send('Missing authorization code');
        reject(new AuthError('No authorization code received'));
        return;
      }

      try {
        const { tokens } = await oauth2Client.getToken(code);
        await saveTokens(tokens);
        res.send('<h1>Authenticated!</h1><p>You can close this tab and return to the terminal.</p>');
        await logActivity({
          timestamp: new Date().toISOString(),
          operation: 'login',
          path: '/',
          status: 'success',
        });
        resolve();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).send(`<h1>Authentication failed</h1><p>${message}</p>`);
        reject(error);
      }
    });
  });

  const server = app.listen(port, () => {
    console.log(`Opening browser for authentication...`);
    console.log(`If browser doesn't open, visit: ${authUrl}`);
    console.log(`\nNeed to add a test user? ${getConsentScreenUrl()}\n`);
    open(authUrl);
  });

  try {
    await tokenPromise;
    console.log('Authentication successful!');
  } finally {
    server.close();
  }
}

export async function runAuthLogout(): Promise<void> {
  const { loadTokens: load } = await import('./tokens.js');
  const tokens = await load();

  if (tokens?.refresh_token) {
    try {
      const oauth2Client = await createOAuth2Client();
      await oauth2Client.revokeToken(tokens.refresh_token);
    } catch {
      // Token may already be invalid
    }
  }

  await clearTokens();
  await logActivity({
    timestamp: new Date().toISOString(),
    operation: 'logout',
    path: '/',
    status: 'success',
  });

  console.log('Logged out successfully.');
}
