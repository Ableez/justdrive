# justdrive

Move files between machines through your own Google Drive. A machine signs in
once, gets a short-lived Google token, and talks to Drive directly, so file
bytes never pass through our servers. The web app only issues tokens and keeps
track of devices and transfers.

## Install the CLI

```bash
curl -fsSL https://justdrive.astexlabs.com/install.sh | sh
justdrive login
```

Needs node 20 or newer. The script installs to `~/.local/bin` by default
(`JUSTDRIVE_BIN_DIR` overrides it).

## Layout

| Path | What it is |
| --- | --- |
| `apps/web` | Next.js app: sign-in, device approvals, activity, transfers |
| `packages/cli` | The `justdrive` command line client |
| `packages/shared` | Shared types, constants, URLs and helpers |

## Development

```bash
pnpm install
pnpm dev        # runs every package
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

The web app listens on http://localhost:3000. `pnpm dev` builds
`packages/shared` first; run `pnpm --filter @juststore/shared dev` to rebuild
it while you work.

## Environment

| Variable | Used by | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | web | Pooled Postgres connection string |
| `DATABASE_URL_UNPOOLED` | web | Direct connection string, used by migrations |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | web | Google OAuth client |
| `JUSTDRIVE_BASE_URL` | web | Public origin of the app, e.g. `https://justdrive.astexlabs.com` |
| `TOKEN_ENCRYPTION_KEYS` | web | JSON map of base64 keys, e.g. `{"1":"<base64 32 bytes>"}` |
| `JUSTDRIVE_API_URL` | cli | Base URL of the API, defaults to the hosted service |

Apply the schema with:

```bash
pnpm --filter @juststore/web db:migrate
```

## License

MIT
