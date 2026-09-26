# justdrive cloud: plan

**Status:** draft for review · **Date:** 2026-09-26
**Web app:** `https://drive.astexlabs.com` (Next.js, `apps/web`) · **CLI:** `justdrive` (`packages/cli`)

## 1. Goal

Move files between VPS/remote machines quickly, using the user's Google Drive as storage, with one
place to manage it all.

- The user connects their Google account **once**, on drive.astexlabs.com.
- On any machine, `justdrive login` authenticates against drive.astexlabs.com, **not** Google.
- The profile shows every machine, full activity history, and lets the user **revoke any machine**.

### Decisions already made

| Decision | Choice |
|---|---|
| Where file data flows | **Token vending**: machines get short-lived Google access tokens and talk to Drive directly. File data never passes through our servers. |
| Name / domain | **justdrive**, served at `drive.astexlabs.com` |
| Standalone/local mode (own Google client, local login, local dashboard) | **Dropped** |

## 2. Architecture

```
 Browser (once)                    drive.astexlabs.com                       Google
 ──────────────                    ───────────────────                       ──────
 Sign in with Google  ──────────►  keeps the Google refresh token,     ◄──►  OAuth (web client)
 (+ Drive consent)                 encrypted; never sent to machines
                                   owns the user's juststore root folder
 Any machine
 ───────────
 justdrive login  ──────────────►  device-code flow (RFC 8628): user
                                   approves + names the machine on web
                             ◄───  device refresh token (rotating)
 justdrive <any cmd>  ──────────►  POST /api/cli/drive-token
                             ◄───  Google access token (≤1h) + root folder id
 file bytes  ────────────────────────────────────────────────────────────►  Drive API, direct
 activity events  ──────────────►  history, devices, transfers
```

Why this shape:

- **No browser needed on the VPS.** The device flow prints a URL and a short code. The user approves it on their laptop.
- **Machines never hold the Google refresh token.** A compromised VPS leaks at most a device token (revocable)
  and a Google access token that dies within an hour.
- **`drive.file` scope works everywhere.** Every machine's Google token comes from the same grant on the same
  OAuth client, so all machines see all justdrive files. `drive.file` is a non-sensitive scope, so there is no
  CASA security assessment and no "unverified app" screen once brand verification passes.
- **No upload size limits from our hosting.** Serverless request bodies are capped at about 4.5 MB, but file bytes never touch our servers.

## 3. Identity and tokens

| Token | Lives on | Lifetime | Stored as | Revoked by |
|---|---|---|---|---|
| Google refresh token | Server only | Until the user disconnects | AES-256-GCM encrypted, AAD = user id, versioned key | "Disconnect Google" (also revoked at Google) |
| Google access token | Server cache + machines | ≤1h (Google-set) | Encrypted cache row per user | Expires; killed early only by disconnecting Google |
| Web session | Browser cookie | 30 days sliding | SHA-256 hash | Logout, "sign out everywhere" |
| Device refresh token `jd_rt_…` | Machine (`0600` file) | 90 days sliding, **rotated on every use** | SHA-256 hash | Revoke device, reuse detection |
| Device access token `jd_at_…` | Machine | 1h | SHA-256 hash | Revoke device (checked on every request) |

Notes:
- **Account = Google identity.** Sign-in and Drive consent happen in one Google consent screen
  (`openid email drive.file`), so there is no separate password or auth provider to run.
- **Rotation with reuse detection.** If an old device refresh token is presented again, it was copied off the
  machine. Revoke that device's whole token family and record a `device_token_reuse` security event.
- **Revocation window.** Revoking a device blocks new Google tokens immediately. A Google access token already
  handed out keeps working until it expires (≤1h), because Google can't revoke one access token without
  revoking the whole grant. The kill switch for "a machine is compromised right now" is
  **Disconnect Google**: it revokes the grant (killing every outstanding token), then the user reconnects.
  The UI should offer this next to "Revoke". *(Verify during M3 that revoking the refresh token invalidates
  outstanding access tokens.)*
- **Token prefixes** (`jd_rt_`, `jd_at_`) let GitHub secret scanning and our own logs spot leaked tokens.

## 4. Data model (Postgres)

```
users               id, google_sub (unique), email, drive_root_folder_id, created_at, deleted_at
google_connections  user_id (pk), refresh_token_enc, key_version, scopes, status (active|revoked|error),
                    access_token_enc, access_token_expires_at, connected_at, last_refreshed_at
web_sessions        id_hash (pk), user_id, created_at, expires_at, ip, user_agent
devices             id, user_id, name, hostname, os, cli_version, created_at, last_seen_at, last_ip, revoked_at
device_tokens       id, device_id, kind (refresh|access), token_hash (unique), family_id, parent_id,
                    expires_at, used_at, revoked_at
device_auth_requests  device_code_hash (pk), user_code (unique), hostname, os, cli_version, request_ip,
                    status (pending|approved|denied|expired), user_id, device_id, expires_at, last_polled_at
events              id, user_id, device_id (nullable), type, path, drive_file_id, bytes, status, detail, ip, at
transfers           id, user_id, from_device_id, to_device_id, drive_file_id, name, bytes,
                    status (pending|delivered|expired), created_at, delivered_at
```

`drive_root_folder_id` now lives on the server. That removes the per-machine root-folder lookup and the
stale-cache class of bugs: every machine uses the same folder.

`events.type`: `upload, download, mkdir, mv, rm, share, send, receive` (reported by the CLI) plus
`login, device_approved, device_revoked, drive_token_issued, device_token_reuse, google_connected,
google_disconnected` (recorded by the server).

## 5. API

### Web (session cookie)

| Route | Purpose |
|---|---|
| `GET /login` → `GET /auth/google/callback` | Google OAuth (web client, PKCE + state, `access_type=offline`). Creates user, stores encrypted refresh token, creates or locates the root folder |
| `POST /logout` | End session |
| `GET /device?code=…` · `POST /device/approve` · `POST /device/deny` | Enter or confirm the code. Shows the requesting hostname, IP, OS and CLI version, and lets the user name the machine |
| `GET /devices` · `DELETE /api/devices/:id` · `PATCH /api/devices/:id` | List, revoke, rename |
| `GET /activity` | History, filterable by device, type, path |
| `GET /transfers` | Sent and received between machines |
| `POST /api/google/disconnect` | Revoke at Google, wipe tokens, mark all devices as needing reconnect |
| `DELETE /api/account` | Revoke at Google, delete all data (required by Google's user-data policy) |

### CLI (`Authorization: Bearer jd_at_…`, except the token endpoints)

| Route | Purpose |
|---|---|
| `POST /api/cli/device/code` | `{hostname, os, cli_version}` → `{device_code, user_code, verification_uri, verification_uri_complete, expires_in: 600, interval: 5}` |
| `POST /api/cli/token` | `grant_type=device_code` (poll: `authorization_pending`, `slow_down`, `access_denied`, `expired_token`) or `grant_type=refresh_token` (rotation) → `{access_token, refresh_token, expires_in, device}` |
| `POST /api/cli/drive-token` | → `{access_token, expires_at, root_folder_id}`. Serves the cached Google token or refreshes it (serialized per user). Records `drive_token_issued` |
| `POST /api/cli/events` | Batched activity events (best effort, queued locally when offline) |
| `GET /api/cli/devices` | Resolves `--to <name>` for transfers |
| `POST /api/cli/transfers` · `GET /api/cli/transfers?inbox` · `POST /api/cli/transfers/:id/ack` | Send, inbox, mark received |
| `POST /api/cli/logout` | Revoke own device |

## 6. CLI changes

**Commands**

```
justdrive login [--name vps-2]      device flow; prints URL + code, polls, saves device tokens
justdrive logout                    revokes this device server-side, deletes local tokens
justdrive status                    account, device name, server reachability
justdrive devices                   list machines
justdrive ls | upload | download | mkdir | mv | rm | share     unchanged interface
justdrive send <file> --to <device>     upload + create transfer
justdrive inbox                     pending transfers for this machine
justdrive receive [id|--all] [dir]  download + ack
```

**Internals**

- `drive/client.ts`: build an `OAuth2Client` with **no client id or secret** and set
  `client.refreshHandler = () => fetchDriveToken()`. google-auth-library v9 supports this (confirmed in the
  installed version), so every existing Drive operation keeps working unchanged. It gets a fresh token from the
  server whenever the current one is near expiry.
- New `api/client.ts`: calls to drive.astexlabs.com with automatic device-token refresh and rotation.
  Base URL defaults to `https://drive.astexlabs.com`, overridable with `JUSTDRIVE_API_URL` for local dev and staging.
- Storage: `~/.config/justdrive/credentials.json` (`0600`, atomic write). Reuse today's `writeSecureFile`.
  Ignore the old `~/.juststore` and tell users to run `justdrive login` once.
- `resolver.ts` takes `root_folder_id` from the server instead of searching for it.
- Events: `logActivity` also sends to `/api/cli/events`. The local log stays as an offline queue and flushes on
  the next command.

**Delete:** `config/credentials.ts`, the local PKCE flow in `auth/flow.ts`, `server/`, the `dashboard` command,
`packages/dashboard`, the `express`/`multer`/`open` dependencies, and the `CLI_BUILD_CLIENT_*` tsup defines. The CLI
no longer ships any Google client credentials.

## 7. Security checklist

- **Cookies:** `__Host-` prefix, `Secure; HttpOnly; SameSite=Lax`, no `Domain` attribute, so other
  `*.astexlabs.com` subdomains can never read or set them.
- **CSRF:** check `Origin` on every state-changing web route. CSP with `frame-ancestors 'none'`, which also blocks
  clickjacking of the device-approve button.
- **Device-code phishing:** the approve page shows the requesting IP, hostname and CLI version, plus a warning to "only approve if
  you just ran `justdrive login`". User codes are 8 characters from an unambiguous alphabet, expire after 10 minutes and work once.
  Code entry is rate-limited per session and per IP.
- **Rate limits:** device-code creation, token polling (enforce `interval`/`slow_down`), `drive-token`, events.
- **Encryption key:** 32-byte key from env, with `key_version` so it can be rotated. Never log tokens; redact
  `jd_*` and `ya29.*` in error reporting.
- **Every CLI request** re-checks `devices.revoked_at`, so revocation takes effect immediately for our API.
- **Security events are visible** in activity: new device approved, token reuse, Google disconnected.
- **Account deletion** revokes at Google and hard-deletes data (Google API Services User Data Policy).

## 8. Google Cloud setup and verification

1. Create a **Web application** OAuth client in the justdrive project. Redirect URI:
   `https://drive.astexlabs.com/auth/google/callback`. Use a separate client for local dev (`http://localhost:3000/...`).
2. Verify **astexlabs.com** in Google Search Console (authorized domains must be the top private domain).
3. Consent screen: app name *justdrive*, homepage `https://drive.astexlabs.com`, privacy policy and terms
   pages hosted there, support email.
4. Scopes: `openid`, `email`, `drive.file`. All non-sensitive, so only **brand verification** is needed
   (typically a few days). No security assessment.
5. Set the publishing status to **In production**. Refresh tokens in *Testing* mode expire after 7 days.
6. Delete or retire the old Desktop client once the new CLI is released.

## 9. Milestones

Each milestone ships with tests. M1–M5 together are the MVP.

| # | Scope | Status |
|---|---|---|
| **M0** | Hosting, Postgres, migrations, schema | Done. Neon + Drizzle, 8 tables, migration `apps/web/drizzle`. |
| **M1** | Google sign-in, encrypted tokens, root folder, web sessions | Done. AES-256-GCM with key versioning; `__Host-` cookie; Drive root owned by the server. |
| **M2** | Device flow, approve page, devices page, revoke | Done. RFC 8628 codes, `slow_down` enforcement, per-request revocation check. |
| **M3** | `drive-token` vending, CLI rewrite | Done. `refreshHandler` pulls Google tokens; local auth, local dashboard and the dashboard package are deleted. |
| **M4** | Events API, offline queue, activity UI | Done. Client-generated ids make replay idempotent; the queue is local-first and never blocks a transfer. |
| **M5** | `send / inbox / receive` + transfers UI | Done. Bytes go machine to Drive to machine; only metadata is registered. |
| **M6** | Rate limits, account deletion, legal pages | Code done. **You still need to:** create the Web OAuth client, set the consent screen to *In production*, and submit brand verification. |

### Setting the secrets

```
TOKEN_ENCRYPTION_KEYS   {"1":"<base64 32 bytes>"}   rotate by adding "2"
GOOGLE_CLIENT_ID        from the Web application OAuth client
GOOGLE_CLIENT_SECRET    from the same client
JUSTDRIVE_BASE_URL      https://drive.astexlabs.com
DATABASE_URL            pooled (runtime)
DATABASE_URL_UNPOOLED   direct, used by drizzle-kit only
```

Add all of them to the Vercel project, not just `apps/web/.env.local`.


## 10. Known limitations and open questions

- **≤1h revocation window** for already-issued Google tokens (accepted; "Disconnect Google" is the kill switch).
- **No per-device permissions.** A vended Google token can do anything `drive.file` allows. A read-only machine
  would need the proxy model for that device. Revisit if users ask.
- **History is partly self-reported.** A tampered CLI could skip events. Server-side events (logins, token
  issuance, device changes) are authoritative. Later: reconcile with the Drive Changes API.
- **Files added through the Drive web UI are invisible** under `drive.file`. Later: a Google Picker button on the web
  app to grant access to existing files.
- **Headless automation (CI):** a `JUSTDRIVE_TOKEN` env var for a non-interactive device token. Post-MVP.
- **Open:** Should "Revoke device" also offer to *delete files that device uploaded*? Should revocation or new-device
  approval trigger an email? (That would need an email provider.)
