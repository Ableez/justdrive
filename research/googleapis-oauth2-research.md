# Research: googleapis Node.js SDK — OAuth2 & Token Management

**Issue:** [Ableez/juststore#3](https://github.com/Ableez/juststore/issues/3)
**Date:** 2026-07-16
**Packages:** `googleapis`, `google-auth-library`

---

## 1. OAuth2 Flow Setup

The OAuth2 client comes from `google-auth-library` (re-exported by `googleapis`).

### Constructor — Positional Args

```ts
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  clientId,      // string — from Google Cloud Console
  clientSecret,  // string — from Google Cloud Console
  redirectUri    // string — e.g. 'http://localhost:3000/oauth2callback'
);
```

### Constructor — Options Object

```ts
const oauth2Client = new google.auth.OAuth2({
  clientId: '...',
  clientSecret: '...',
  redirectUri: 'http://localhost:3000/oauth2callback',
});
```

For installed/IoS apps where `client_secret` is not embedded:

```ts
const oauth2Client = new google.auth.OAuth2({
  clientId: '...',
  redirectUri: '...',
  // no clientSecret
});
```

---

## 2. Consent URL Generation

`generateAuthUrl(opts)` returns the full Google consent page URL.

### Signature

```ts
generateAuthUrl(opts?: GenerateAuthUrlOpts): string
```

### Key options

| Field | Type | Description |
|---|---|---|
| `access_type` | `'online'` \| `'offline'` | **Must be `'offline'`** to receive a refresh token |
| `scope` | `string[]` \| `string` | Scopes to request. Array or space-delimited string |
| `prompt` | `'consent'` \| `'select_account'` \| `'none'` | Force consent screen every time with `'consent'` |
| `state` | `string` | CSRF nonce — returned on callback |
| `include_granted_scopes` | `boolean` | Incremental auth |
| `code_challenge` | `string` | PKCE challenge |
| `code_challenge_method` | `'S256'` \| `'plain'` | PKCE method |
| `login_hint` | `string` | Pre-fill email |
| `hd` | `string` | G Suite hosted domain filter |

### Example

```ts
const scopes = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];

const url = oauth2Client.generateAuthUrl({
  access_type: 'offline',   // REQUIRED for refresh_token
  scope: scopes,
  prompt: 'consent',        // forces refresh_token on every auth (useful for dev)
});
```

**Gotcha:** The `refresh_token` is **only returned on the first authorization**. If the user has already granted consent, subsequent token exchanges will **not** include a refresh token unless you set `prompt: 'consent'` to force re-consent.

---

## 3. Token Exchange

After the user consents, Google redirects to `redirectUri?code=<authorizationCode>`.

### Exchange code for tokens

```ts
const { tokens } = await oauth2Client.getToken(authorizationCode);
// tokens: Credentials — contains access_token, refresh_token (first auth only), etc.

oauth2Client.setCredentials(tokens);
```

### `getToken()` signatures

```ts
getToken(code: string): Promise<GetTokenResponse>
getToken(options: GetTokenOptions): Promise<GetTokenResponse>
```

### `GetTokenResponse` shape

```ts
interface GetTokenResponse {
  tokens: Credentials;
  res: GaxiosResponse<any>; // raw HTTP response
}
```

---

## 4. Token Persistence

### `Credentials` interface (the token object)

```ts
interface Credentials {
  access_token?: string | null;   // Bearer token sent to Google APIs
  refresh_token?: string | null;  // Only present on first auth with access_type: 'offline'
  expiry_date?: number | null;    // Epoch ms when access_token expires
  id_token?: string | null;       // JWT identity token (OpenID Connect)
  token_type?: string | null;     // Always 'Bearer'
  scope?: string;                 // Space-delimited granted scopes
}
```

### What to persist

At minimum: **`refresh_token`**. The access token is short-lived (~1 hour) and will be auto-refreshed. Store the full `Credentials` object if convenient.

### Save to disk (JSON file)

```ts
import fs from 'fs';

const TOKEN_PATH = '~/.juststore/token.json';

function saveTokens(tokens: Credentials) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

function loadTokens(): Credentials | null {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  } catch {
    return null;
  }
}
```

### Reload on subsequent CLI runs

```ts
const storedTokens = loadTokens();
if (storedTokens) {
  oauth2Client.setCredentials(storedTokens);
}
```

### Listen for token updates (auto-persist)

```ts
oauth2Client.on('tokens', (tokens: Credentials) => {
  if (tokens.refresh_token) {
    saveTokens(tokens);
  }
  // access_token updates also fire here — persist if you want caching
  saveTokens({ ...loadTokens(), ...tokens });
});
```

**Gotcha:** The `tokens` event fires when the SDK auto-refreshes the access token. Use it to keep your stored copy up to date with the latest `access_token` and `expiry_date`.

---

## 5. Automatic Token Refresh

**Yes — the SDK handles refresh automatically.** When:

1. The OAuth2 client has a `refresh_token` set via `setCredentials()`
2. The `access_token` is expired (or about to expire within `eagerRefreshThresholdMillis`)

...the SDK will transparently:
- Use the refresh token to get a new access token
- Retry the failed request
- Emit a `tokens` event with the new credentials

### Configuration knobs

```ts
oauth2Client.eagerRefreshThresholdMillis = 5 * 60 * 1000; // refresh 5min early (default)
oauth2Client.forceRefreshOnFailure = true; // retry with fresh token on 401/403
```

### Manual refresh (if needed)

```ts
const { credentials } = await oauth2Client.refreshAccessToken();
oauth2Client.setCredentials(credentials);
```

**Gotcha:** If the refresh token itself is revoked, expired (6 months unused), or the user changed passwords, the refresh will fail. Your code should handle this gracefully and re-prompt for auth.

---

## 6. Token Revocation

### Method 1: Revoke the stored access/refresh token via HTTP

```ts
// Revoke a specific token
await oauth2Client.revokeToken(refreshToken);

// Or get the revocation URL and call it yourself
const revokeUrl = google.auth.OAuth2.getRevokeTokenUrl(refreshToken);
```

### Method 2: Revoke credentials on the client

```ts
// Revokes the access_token AND clears credentials from the client
await oauth2Client.revokeCredentials();
```

### Full logout flow

```ts
async function logout() {
  const tokens = loadTokens();
  if (tokens?.refresh_token) {
    await oauth2Client.revokeToken(tokens.refresh_token);
  }
  oauth2Client.setCredentials({}); // clear in-memory credentials
  fs.unlinkSync(TOKEN_PATH);       // delete stored token file
}
```

**Gotcha:** `revokeToken()` revokes the token server-side. `revokeCredentials()` revokes the current access_token and clears the client, but does **not** revoke the refresh token. For a full logout, revoke the refresh token explicitly.

---

## 7. Redirect URI for Local Dashboard

### Yes — `http://localhost:<port>/oauth2callback` works

This is the standard pattern for local OAuth2 flows. Configure it in:

1. **Google Cloud Console** → APIs & Credentials → OAuth 2.0 Client IDs → Authorized redirect URIs → add `http://localhost:3000/oauth2callback`
2. **Constructor** → pass the same URI as `redirectUri`

### Express server catching the callback

```ts
import express from 'express';

const app = express();

app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code as string;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Persist tokens
    saveTokens(tokens);

    res.send('Authentication successful! You can close this tab.');
  } catch (err) {
    res.status(500).send('Authentication failed: ' + err.message);
  }
});

app.listen(3000);
```

### Full flow with `http` module (from official sample)

```ts
const server = http
  .createServer(async (req, res) => {
    if (req.url.indexOf('/oauth2callback') > -1) {
      const qs = new url.URL(req.url, 'http://localhost:3000').searchParams;
      res.end('Authentication successful! Please return to the console.');
      server.destroy();

      const { tokens } = await oauth2Client.getToken(qs.get('code'));
      oauth2Client.setCredentials(tokens);
    }
  })
  .listen(3000, () => {
    // Open browser to consent URL
    open(authorizeUrl, { wait: false }).then((cp) => cp.unref());
  });
```

### Dynamic port

If you need a dynamic port, set the redirect URI at `generateAuthUrl` time too:

```ts
const port = 0; // let OS assign
const server = http.createServer(handler).listen(port, () => {
  const actualPort = (server.address() as any).port;
  const redirectUri = `http://localhost:${actualPort}/oauth2callback`;
  // Re-create client or override:
  oauth2Client.redirectUri = redirectUri; // private — use constructor instead
});
```

**Gotcha:** The redirect URI in the constructor, in `generateAuthUrl`, and in Google Cloud Console **must match exactly** (including trailing slash, scheme, and port).

---

## 8. Google Drive Client Setup

### Creating the Drive client

```ts
import { google, drive_v3 } from 'googleapis';

const drive: drive_v3.Drive = google.drive({
  version: 'v3',
  auth: oauth2Client,  // authenticated OAuth2Client
});
```

### Common Operations

#### List files

```ts
const res = await drive.files.list({
  pageSize: 10,
  fields: 'nextPageToken, files(id, name, mimeType, modifiedTime)',
  q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
});
const files = res.data.files; // drive_v3.Schema$File[]
```

#### Get file metadata

```ts
const res = await drive.files.get({
  fileId: '...',
  fields: 'id, name, mimeType, size, modifiedTime, parents',
});
```

#### Download file content

```ts
const res = await drive.files.get(
  { fileId: '...', alt: 'media' },
  { responseType: 'stream' }
);
// Pipe to filesystem
const dest = fs.createWriteStream('./downloaded.pdf');
res.data.pipe(dest);
```

#### Create (upload) a file

```ts
const res = await drive.files.create({
  requestBody: {
    name: 'test.txt',
    mimeType: 'text/plain',
    parents: ['<folder_id>'], // optional parent folder
  },
  media: {
    mimeType: 'text/plain',
    body: fs.createReadStream('./test.txt'),
  },
});
// res.data.id — the new file ID
```

#### Update file content

```ts
const res = await drive.files.update({
  fileId: '...',
  media: {
    mimeType: 'text/plain',
    body: fs.createReadStream('./updated.txt'),
  },
});
```

#### Update file metadata

```ts
const res = await drive.files.update({
  fileId: '...',
  requestBody: {
    name: 'renamed.txt',
  },
});
```

#### Delete a file

```ts
await drive.files.delete({ fileId: '...' });
```

#### Create a folder

```ts
const res = await drive.files.create({
  requestBody: {
    name: 'My Folder',
    mimeType: 'application/vnd.google-apps.folder',
    parents: ['<parent_folder_id>'],
  },
});
```

#### Search with query

```ts
const res = await drive.files.list({
  q: "name contains 'report' and mimeType != 'application/vnd.google-apps.folder' and trashed=false",
  fields: 'files(id, name, mimeType)',
  orderBy: 'modifiedTime desc',
});
```

### Pagination

```ts
let pageToken: string | undefined;
do {
  const res = await drive.files.list({
    pageSize: 100,
    pageToken,
    fields: 'nextPageToken, files(id, name)',
  });
  // process res.data.files
  pageToken = res.data.nextPageToken ?? undefined;
} while (pageToken);
```

### TypeScript types

```ts
import { drive_v3 } from 'googleapis';

const file: drive_v3.Schema$File = { id: '...', name: '...' };
const listParams: drive_v3.Params$Resource$Files$List = { pageSize: 10 };
const fileList: drive_v3.Schema$FileList = res.data;
```

---

## Summary of Required Scopes for juststore

| Scope | Purpose |
|---|---|
| `https://www.googleapis.com/auth/drive.file` | Create/modify files the app creates (least privilege) |
| `https://www.googleapis.com/auth/drive.metadata.readonly` | Read file metadata/list files |
| `https://www.googleapis.com/auth/drive.readonly` | Read file content |

Use `drive.file` + `drive.metadata.readonly` for a "upload and manage your own files" model. Add `drive.readonly` if the app needs to read arbitrary files the user selects.

---

## Dependencies to Install

```bash
npm install googleapis
# google-auth-library is a transitive dependency — no need to install separately
```

---

## Sources

- [google-api-nodejs-client README — OAuth2 section](https://github.com/googleapis/google-api-nodejs-client#oauth2-client)
- [Official OAuth2 sample](https://github.com/googleapis/google-api-nodejs-client/blob/main/samples/oauth2.js)
- [Google Cloud Docs — OAuth2Client class](https://cloud.google.com/nodejs/docs/reference/google-auth-library/latest/google-auth-library/oauth2client)
- [Google Cloud Docs — Credentials interface](https://cloud.google.com/nodejs/docs/reference/google-auth-library/latest/google-auth-library/credentials)
- [Google Cloud Docs — GenerateAuthUrlOpts interface](https://cloud.google.com/nodejs/docs/reference/google-auth-library/latest/google-auth-library/generateauthurlopts)
- [Google Cloud Docs — Google Auth Library overview](https://cloud.google.com/nodejs/docs/reference/google-auth-library/latest)
