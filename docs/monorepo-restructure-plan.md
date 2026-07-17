# Monorepo Structure & Build Pipeline — Implementation Plan

**Issue:** [#4](https://github.com/Ableez/juststore/issues/4)
**Status:** Unblocked — ready for implementation
**Date:** 2026-07-16

---

## Goal

Restructure the juststore repository from a single Next.js app at root into a pnpm + turborepo monorepo with three packages (`packages/cli`, `packages/dashboard`, `packages/shared`) and one app (`apps/web`). The CLI bundles the dashboard SPA so `juststore dashboard` serves it directly. A different agent should be able to implement this plan end-to-end without reading the GitHub issues.

---

## Decisions (Locked)

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Workspace tool | pnpm workspaces + turborepo | pnpm already partially configured; turbo adds caching, parallel tasks, explicit dependency graph |
| 2 | Build order | `shared` → `cli`, `dashboard` (turbo `^build`) | turbo's `dependsOn: ["^build"]` ensures deps build first |
| 3 | CLI bundling | tsup; copies dashboard SPA dist into CLI | Single npm package contains everything; `juststore dashboard` serves embedded SPA |
| 4 | Dev workflow | `turbo dev` runs all packages concurrently | Each package gets its own watch/dev process |
| 5 | Current Next.js app | Move to `apps/web/` | It's a marketing/docs site, separate from the tool |
| 6 | Dashboard entry | CLI subcommand: `juststore dashboard` | Single binary, single install |
| 7 | Dashboard port | Fixed 4000, auto-increment if occupied | Predictable, but resilient to port conflicts |

---

## Current State

The repo is a Next.js app scaffolded at root:

```
juststore/
├── src/app/           # Next.js app directory
├── public/            # Static assets
├── package.json       # Next.js deps (next, react, react-dom)
├── pnpm-workspace.yaml  # Exists but has no package paths
├── tsconfig.json      # Next.js-specific TS config
├── next.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── docs/              # google-drive-api-research.md
└── research/          # googleapis-oauth2-research.md
```

### Existing Credentials (from Issue #7)

- Google Cloud project: `juststore-502602`
- Client ID: `332263446893-7eqa5a1ij2f3dtc254rfq7srbb702la8.apps.googleusercontent.com`
- Credentials file: `~/Downloads/client_secret_332263446893-7eqa5a1ij2f3dtc254rfq7srbb702la8.apps.googleusercontent.com.json`
- OAuth scope: `https://www.googleapis.com/auth/drive` (restricted, full access)
- Redirect URI: `http://localhost` (Desktop app type; append `/oauth2callback` in code)
- Drive API enabled, OAuth consent screen configured

---

## Target Directory Structure

```
juststore/
├── apps/
│   └── web/                          # Current Next.js app (moved from root)
│       ├── src/app/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   └── globals.css
│       ├── public/
│       ├── package.json              # Next.js deps only
│       ├── tsconfig.json             # Next.js-specific (does NOT extend base)
│       ├── next.config.ts
│       ├── eslint.config.mjs
│       └── postcss.config.mjs
│
├── packages/
│   ├── shared/                       # Types, constants, utilities
│   │   ├── src/
│   │   │   ├── index.ts              # Re-exports everything
│   │   │   ├── types.ts              # DriveFile, ActivityLogEntry, OAuthTokens, Config
│   │   │   ├── constants.ts          # JUSTSTORE_ROOT, DEFAULT_PORT, paths
│   │   │   └── utils.ts              # normalizePath, findAvailablePort, error classes
│   │   ├── package.json
│   │   └── tsconfig.json             # Extends ../../tsconfig.base.json
│   │
│   ├── cli/                          # CLI entry point (npm package: "juststore")
│   │   ├── src/
│   │   │   ├── index.ts              # Commander program setup, registers subcommands
│   │   │   ├── commands/             # One file per command group
│   │   │   │   ├── auth.ts           # login, logout
│   │   │   │   ├── files.ts          # upload, download, ls, mkdir, mv, rm
│   │   │   │   ├── share.ts          # share
│   │   │   │   ├── status.ts         # status
│   │   │   │   └── dashboard.ts      # dashboard subcommand
│   │   │   ├── drive/                # Google Drive operations
│   │   │   │   ├── client.ts         # OAuth2 + Drive client setup
│   │   │   │   ├── resolver.ts       # Path resolution (walk tree segment-by-segment)
│   │   │   │   ├── operations.ts     # upload, download, list, mkdir, mv, rm, share
│   │   │   │   └── cache.ts          # Folder ID caching in ~/.juststore/cache.json
│   │   │   ├── auth/                 # OAuth flow
│   │   │   │   ├── flow.ts           # generateAuthUrl, start temp Express, catch callback
│   │   │   │   └── tokens.ts         # Save/load/revoke tokens from ~/.juststore/token.json
│   │   │   ├── logger/               # Activity logging
│   │   │   │   └── index.ts          # Append to ~/.juststore/activity.json
│   │   │   └── output/               # Output formatting
│   │   │       ├── table.ts          # Table formatter for ls
│   │   │       ├── progress.ts       # Progress bar (ora or cli-progress)
│   │   │       └── json.ts           # --json flag handler
│   │   ├── bin/
│   │   │   └── juststore.js          # #!/usr/bin/env node → ../dist/index.js
│   │   ├── tsup.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json             # Extends ../../tsconfig.base.json
│   │
│   └── dashboard/                    # Vite React SPA + Express API
│       ├── src/
│       │   ├── client/               # React SPA
│       │   │   ├── index.html        # Vite entry HTML
│       │   │   ├── main.tsx          # React root mount
│       │   │   ├── App.tsx           # Router: Activity, Files, Upload, Auth
│       │   │   ├── components/       # UI components
│       │   │   │   ├── ActivityLog.tsx
│       │   │   │   ├── FileBrowser.tsx
│       │   │   │   ├── UploadForm.tsx
│       │   │   │   └── AuthStatus.tsx
│       │   │   └── api/              # Fetch wrappers for Express API routes
│       │   │       └── client.ts
│       │   └── server/               # Express API
│       │       └── index.ts          # /oauth2callback, /api/* routes, SPA static serve
│       ├── vite.config.ts
│       ├── package.json
│       └── tsconfig.json             # Extends ../../tsconfig.base.json
│
├── turbo.json                        # Turborepo pipeline config
├── pnpm-workspace.yaml               # Updated: packages/*, apps/*
├── package.json                      # Root: shared devDeps, workspace scripts
├── tsconfig.base.json                # Shared TS config (extended by packages)
├── .gitignore                        # Updated for monorepo
├── .env                              # OAuth credentials (gitignored)
├── docs/
│   ├── google-drive-api-research.md
│   └── monorepo-restructure-plan.md  # This file
└── research/
    └── googleapis-oauth2-research.md
```

---

## Implementation Steps

### Step 1: Update `pnpm-workspace.yaml`

Replace the current contents with:

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

### Step 2: Create root `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

**How `^build` works:** When turbo builds `packages/cli`, it sees that `cli` depends on `@juststore/shared` (in package.json). It builds `shared` first, then `cli`. Both `cli` and `dashboard` depend on `shared`, so they wait for it, but build in parallel with each other.

### Step 3: Create root `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "exclude": ["node_modules", "dist"]
}
```

Each package's `tsconfig.json` extends this and overrides `outDir`, `rootDir`, `include` as needed.

### Step 4: Update root `package.json`

```json
{
  "name": "juststore-root",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "clean": "turbo clean"
  },
  "devDependencies": {
    "turbo": "^2",
    "typescript": "^5"
  },
  "packageManager": "pnpm@9.0.0"
}
```

**Remove** all Next.js dependencies from root (they move to `apps/web/package.json`).

### Step 5: Update `.gitignore`

Add these entries (keep existing ones):

```gitignore
# turborepo
.turbo

# dist outputs (all packages)
packages/*/dist
apps/*/.next

# environment
.env
.env.local

# juststore local config
.juststore/
```

### Step 6: Scaffold `packages/shared/`

#### `packages/shared/package.json`

```json
{
  "name": "@juststore/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  }
}
```

#### `packages/shared/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

#### `packages/shared/src/types.ts`

```ts
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string | null;
  modifiedTime?: string | null;
  createdTime?: string | null;
  thumbnailLink?: string | null;
  webViewLink?: string | null;
  parents?: string[];
  shared?: boolean;
  trashed?: boolean;
}

export interface ActivityLogEntry {
  timestamp: string;          // ISO 8601
  operation: 'upload' | 'download' | 'mkdir' | 'mv' | 'rm' | 'share' | 'login' | 'logout';
  path: string;               // Drive path
  status: 'success' | 'error';
  detail?: string;            // Error message or extra info
}

export interface OAuthTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  token_type?: string | null;
  scope?: string;
}

export interface Config {
  rootFolderId?: string;      // Cached juststore/ folder ID
  userEmail?: string;         // Cached user email
}
```

#### `packages/shared/src/constants.ts`

```ts
export const JUSTSTORE_ROOT_FOLDER = 'juststore';
export const DEFAULT_PORT = 4000;
export const MAX_PORT_ATTEMPTS = 100;
export const CONFIG_DIR = '.juststore';
export const TOKEN_FILE = 'token.json';
export const CACHE_FILE = 'cache.json';
export const ACTIVITY_LOG_FILE = 'activity.json';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
export const DRIVE_FIELDS = 'id, name, mimeType, size, modifiedTime, createdTime, thumbnailLink, webViewLink, parents, shared, trashed';
```

#### `packages/shared/src/utils.ts`

```ts
import { DEFAULT_PORT, MAX_PORT_ATTEMPTS } from './constants.js';
import net from 'net';

export function normalizePath(path: string): string {
  // Strip leading ./ or juststore/ prefix
  let p = path.replace(/^\.\/?/, '').replace(/^juststore\/?/, '');
  // Strip trailing slash
  p = p.replace(/\/+$/, '');
  return p;
}

export function isAbsolutePath(path: string): boolean {
  return path.startsWith('/');
}

export async function findAvailablePort(startPort: number = DEFAULT_PORT): Promise<number> {
  for (let port = startPort; port < startPort + MAX_PORT_ATTEMPTS; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No available port found in range ${startPort}-${startPort + MAX_PORT_ATTEMPTS}`);
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => { server.close(); resolve(true); });
    server.listen(port);
  });
}

export class JustStoreError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'JustStoreError';
  }
}

export class AuthError extends JustStoreError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthError';
  }
}

export class PathNotFoundError extends JustStoreError {
  constructor(path: string) {
    super(`Path not found: ${path}`, 'PATH_NOT_FOUND');
    this.name = 'PathNotFoundError';
  }
}
```

#### `packages/shared/src/index.ts`

```ts
export * from './types.js';
export * from './constants.js';
export * from './utils.js';
```

### Step 7: Scaffold `packages/cli/`

#### `packages/cli/package.json`

```json
{
  "name": "juststore",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "juststore": "./bin/juststore.js"
  },
  "scripts": {
    "build": "tsup && cp -r ../dashboard/dist ./dist/dashboard-spa",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@juststore/shared": "workspace:*",
    "commander": "^12",
    "googleapis": "^144",
    "express": "^4",
    "open": "^10",
    "ora": "^8",
    "chalk": "^5",
    "cli-table3": "^0.6"
  },
  "devDependencies": {
    "tsup": "^8",
    "@types/express": "^4",
    "@types/node": "^20"
  }
}
```

#### `packages/cli/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

#### `packages/cli/tsup.config.ts`

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: false,
  splitting: false,
});
```

#### `packages/cli/bin/juststore.js`

```js
#!/usr/bin/env node
import '../dist/index.js';
```

#### `packages/cli/src/index.ts` (skeleton)

```ts
import { Command } from 'commander';
import { authCommand } from './commands/auth.js';
import { filesCommand } from './commands/files.js';
import { shareCommand } from './commands/share.js';
import { statusCommand } from './commands/status.js';
import { dashboardCommand } from './commands/dashboard.js';

const program = new Command();

program
  .name('juststore')
  .description('CLI tool for Google Drive file management')
  .version('0.1.0');

program.addCommand(authCommand);
program.addCommand(filesCommand);
program.addCommand(shareCommand);
program.addCommand(statusCommand);
program.addCommand(dashboardCommand);

program.parse();
```

#### `packages/cli/src/commands/dashboard.ts` (skeleton)

```ts
import { Command } from 'commander';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { findAvailablePort } from '@juststore/shared';

export const dashboardCommand = new Command('dashboard')
  .description('Start the companion dashboard')
  .action(async () => {
    const app = express();
    const port = await findAvailablePort();

    // Serve embedded SPA
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const spaPath = path.resolve(__dirname, '../dashboard-spa');
    app.use(express.static(spaPath));

    // OAuth callback endpoint
    app.get('/oauth2callback', async (req, res) => {
      // Token exchange logic here
      res.send('Authenticated! Close this tab.');
    });

    // API routes
    app.get('/api/activity', (req, res) => {
      // Read and return activity log
    });

    app.get('/api/files', async (req, res) => {
      // List files from Drive
    });

    app.listen(port, () => {
      console.log(`Dashboard running at http://localhost:${port}`);
    });
  });
```

### Step 8: Scaffold `packages/dashboard/`

#### `packages/dashboard/package.json`

```json
{
  "name": "@juststore/dashboard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@juststore/shared": "workspace:*",
    "react": "^19",
    "react-dom": "^19"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^4",
    "typescript": "^5",
    "vite": "^6"
  }
}
```

#### `packages/dashboard/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler"
  },
  "include": ["src"]
}
```

#### `packages/dashboard/vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/client',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
});
```

#### `packages/dashboard/src/client/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>juststore dashboard</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

#### `packages/dashboard/src/client/main.tsx`

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

#### `packages/dashboard/src/client/App.tsx` (skeleton)

```tsx
export function App() {
  return (
    <div>
      <h1>juststore dashboard</h1>
      <nav>
        <a href="/">Activity</a> | <a href="/files">Files</a> | <a href="/upload">Upload</a> | <a href="/auth">Auth</a>
      </nav>
      <main>
        {/* Router/content here */}
      </main>
    </div>
  );
}
```

### Step 9: Move Next.js app to `apps/web/`

1. Create `apps/web/` directory
2. Move these files from root into `apps/web/`:
   - `src/` → `apps/web/src/`
   - `public/` → `apps/web/public/`
   - `next.config.ts` → `apps/web/next.config.ts`
   - `next-env.d.ts` → `apps/web/next-env.d.ts`
   - `eslint.config.mjs` → `apps/web/eslint.config.mjs`
   - `postcss.config.mjs` → `apps/web/postcss.config.mjs`
   - `tsconfig.json` → `apps/web/tsconfig.json` (keep as-is, do NOT extend base)
3. Create `apps/web/package.json`:

```json
{
  "name": "@juststore/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "next": "16.2.10",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "babel-plugin-react-compiler": "1.0.0",
    "eslint": "^9",
    "eslint-config-next": "16.2.10",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

4. Delete the moved files from root (they now live in `apps/web/`)
5. Keep `docs/`, `research/`, `.gitignore` at root

### Step 10: Install dependencies and verify

```bash
# From repo root
pnpm install

# Verify turbo sees all packages
turbo build

# Verify dev mode
turbo dev

# Verify CLI
cd packages/cli
node bin/juststore.js --help
```

---

## Key Technical Details

### Dashboard SPA Embedding Flow

1. `packages/dashboard` builds React SPA via Vite → `packages/dashboard/dist/` (static HTML/JS/CSS)
2. `packages/cli` build script runs `cp -r ../dashboard/dist ./dist/dashboard-spa`
3. At runtime, `juststore dashboard` command:
   - Resolves `dist/dashboard-spa` path relative to the CLI package
   - Serves it with `express.static()`
   - Mounts API routes on the same Express server
4. Turborepo ensures `dashboard` builds before `cli` (via `^build` dependency chain)

### Auth Flow

1. `juststore auth login`:
   - Creates OAuth2 client with `google.auth.OAuth2(clientId, clientSecret, redirectUri)`
   - Redirect URI: `http://localhost:<port>/oauth2callback`
   - Generates consent URL with `access_type: 'offline'` and `prompt: 'consent'`
   - Starts temporary Express server on port 4000 (or next available)
   - Opens browser via `open` package
   - Catches callback, exchanges code for tokens
   - Saves `refresh_token` to `~/.juststore/token.json`
   - Shuts down temp server
2. `juststore auth logout`:
   - Loads refresh token from `~/.juststore/token.json`
   - Revokes it server-side via `oauth2Client.revokeToken(refreshToken)`
   - Deletes token file

### Path Resolution

The Drive API has no native path access. Resolution walks the tree segment-by-segment:

```
Input: "photos/2024/vacation.jpg"
1. Query: name='photos' and mimeType=folder and parentId=rootId → get photosId
2. Query: name='2024' and mimeType=folder and parentId=photosId → get 2024Id
3. Query: name='vacation.jpg' and parentId=2024Id → get fileId
```

Each segment = 1 API call. Cache path→ID mappings in `~/.juststore/cache.json`.

### OAuth Credentials in `.env`

Create `.env` at repo root (gitignored):

```
GOOGLE_CLIENT_ID=332263446893-7eqa5a1ij2f3dtc254rfq7srbb702la8.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<from ~/Downloads/client_secret_*.json>
GOOGLE_REDIRECT_URI=http://localhost
```

The CLI reads these at runtime. For npm distribution, users provide their own credentials.

---

## Files to Create/Modify (Checklist)

### New files:
- [ ] `turbo.json`
- [ ] `tsconfig.base.json`
- [ ] `packages/shared/package.json`
- [ ] `packages/shared/tsconfig.json`
- [ ] `packages/shared/src/index.ts`
- [ ] `packages/shared/src/types.ts`
- [ ] `packages/shared/src/constants.ts`
- [ ] `packages/shared/src/utils.ts`
- [ ] `packages/cli/package.json`
- [ ] `packages/cli/tsconfig.json`
- [ ] `packages/cli/tsup.config.ts`
- [ ] `packages/cli/bin/juststore.js`
- [ ] `packages/cli/src/index.ts`
- [ ] `packages/cli/src/commands/auth.ts` (skeleton)
- [ ] `packages/cli/src/commands/files.ts` (skeleton)
- [ ] `packages/cli/src/commands/share.ts` (skeleton)
- [ ] `packages/cli/src/commands/status.ts` (skeleton)
- [ ] `packages/cli/src/commands/dashboard.ts` (skeleton)
- [ ] `packages/dashboard/package.json`
- [ ] `packages/dashboard/tsconfig.json`
- [ ] `packages/dashboard/vite.config.ts`
- [ ] `packages/dashboard/src/client/index.html`
- [ ] `packages/dashboard/src/client/main.tsx`
- [ ] `packages/dashboard/src/client/App.tsx` (skeleton)
- [ ] `apps/web/package.json`

### Modified files:
- [ ] `pnpm-workspace.yaml` — add `packages/*` and `apps/*`
- [ ] `package.json` — remove Next.js deps, add turbo
- [ ] `.gitignore` — add `.turbo`, `dist`, `.env`

### Moved files:
- [ ] `src/` → `apps/web/src/`
- [ ] `public/` → `apps/web/public/`
- [ ] `next.config.ts` → `apps/web/next.config.ts`
- [ ] `next-env.d.ts` → `apps/web/next-env.d.ts`
- [ ] `eslint.config.mjs` → `apps/web/eslint.config.mjs`
- [ ] `postcss.config.mjs` → `apps/web/postcss.config.mjs`
- [ ] `tsconfig.json` → `apps/web/tsconfig.json`

### Deleted (after move):
- [ ] `src/` (moved to apps/web/)
- [ ] `public/` (moved to apps/web/)
- [ ] Root `next.config.ts`, `next-env.d.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `tsconfig.json` (moved)

---

## Verification Criteria

After implementation, these should all pass:

1. `pnpm install` — completes without errors
2. `turbo build` — builds shared first, then cli + dashboard in parallel
3. `turbo dev` — starts all three packages in watch/dev mode
4. `cd packages/cli && node bin/juststore.js --help` — shows command list
5. `cd apps/web && pnpm dev` — Next.js app runs independently
6. `turbo typecheck` — all packages pass type checking
7. `turbo lint` — no lint errors
8. Dashboard SPA is embedded in CLI's `dist/dashboard-spa/` after build

---

## Blocked Downstream

- **Issue #6** (Dashboard UI design) is blocked on this issue. Once monorepo structure is locked, the dashboard component design can proceed.
