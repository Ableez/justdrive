import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { DRIVE_SCOPE, LOOPBACK_HOST, PathNotFoundError, findAvailablePort } from '@juststore/shared';
import { listFiles, uploadFile, removeFile, shareFile } from '../drive/operations.js';
import { loadAuth } from '../auth/tokens.js';
import { toAuthError } from '../auth/errors.js';
import { getActivityLog } from '../logger/index.js';

export const SESSION_HEADER = 'x-justdrive-session';
const ALLOWED_HOSTNAMES = new Set([LOOPBACK_HOST, 'localhost', '[::1]']);
// Roles the dashboard may grant. Ownership transfer stays CLI-only.
const DASHBOARD_SHARE_ROLES = new Set(['reader', 'commenter', 'writer']);

const upload = multer({
  dest: path.join(os.tmpdir(), 'justdrive-uploads'),
  limits: { files: 1 },
});

export interface DashboardServerOptions {
  /** Secret the browser must present on every API request. */
  sessionToken: string;
}

export function createDashboardServer(options: DashboardServerOptions): express.Express {
  const app = express();
  const expectedToken = Buffer.from(options.sessionToken);

  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; " +
        "frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );

    // Block DNS rebinding: a hostile domain resolved to 127.0.0.1 still sends
    // its own name in the Host header.
    const hostname = (req.headers.host ?? '').replace(/:\d+$/, '').toLowerCase();
    if (!ALLOWED_HOSTNAMES.has(hostname)) {
      res.status(403).send('Invalid Host header');
      return;
    }
    next();
  });

  // Every API call needs the session key printed at startup. It travels in a
  // custom header, which browsers never attach cross-origin without a CORS
  // preflight this server doesn't answer, so this also blocks CSRF.
  app.use('/api', (req, res, next) => {
    const presented = Buffer.from(req.get(SESSION_HEADER) ?? '');
    if (presented.length !== expectedToken.length || !crypto.timingSafeEqual(presented, expectedToken)) {
      res.status(401).json({
        error: 'Dashboard session key missing or invalid. Open the link printed by `justdrive dashboard`.',
      });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use('/api', express.json());

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const spaPath = path.resolve(__dirname, './dashboard-spa');
  app.use(express.static(spaPath));

  // API: List files
  app.get('/api/files', async (req, res) => {
    try {
      const dirPath = typeof req.query.path === 'string' ? req.query.path : '';
      res.json(await listFiles(dirPath));
    } catch (error) {
      sendError(res, error, 'Failed to list files');
    }
  });

  // API: Upload file (multipart)
  app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    try {
      const drivePath = typeof req.body.drivePath === 'string' && req.body.drivePath ? req.body.drivePath : undefined;
      // multer stores uploads under random temp names; keep the real one.
      const originalName = path.basename(decodeUploadName(req.file.originalname));
      res.json(await uploadFile(req.file.path, drivePath, originalName));
    } catch (error) {
      sendError(res, error, 'Upload failed');
    } finally {
      fs.promises.rm(req.file.path, { force: true }).catch(() => {});
    }
  });

  // API: Move file to trash
  app.delete('/api/files', async (req, res) => {
    try {
      const filePath = req.body?.path;
      if (typeof filePath !== 'string' || !filePath) {
        res.status(400).json({ error: 'path is required' });
        return;
      }
      await removeFile(filePath);
      res.json({ success: true });
    } catch (error) {
      sendError(res, error, 'Delete failed');
    }
  });

  // API: Share file
  app.post('/api/share', async (req, res) => {
    try {
      const { path: filePath, email, role = 'reader' } = req.body ?? {};
      if (typeof filePath !== 'string' || !filePath) {
        res.status(400).json({ error: 'path is required' });
        return;
      }
      if (email !== undefined && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+$/.test(email))) {
        res.status(400).json({ error: 'email is invalid' });
        return;
      }
      if (!DASHBOARD_SHARE_ROLES.has(role)) {
        res.status(400).json({ error: `role must be one of: ${[...DASHBOARD_SHARE_ROLES].join(', ')}` });
        return;
      }
      const link = await shareFile(filePath, email, role);
      res.json({ link });
    } catch (error) {
      sendError(res, error, 'Share failed');
    }
  });

  // API: Activity log
  app.get('/api/activity', async (_req, res) => {
    try {
      res.json(await getActivityLog());
    } catch (error) {
      sendError(res, error, 'Failed to load activity');
    }
  });

  // API: Auth status
  app.get('/api/status', async (_req, res) => {
    try {
      const auth = await loadAuth();
      if (!auth) {
        res.json({ authenticated: false });
        return;
      }
      res.json({
        authenticated: true,
        email: auth.email ?? undefined,
        fullAccess: auth.scopes.includes(DRIVE_SCOPE),
      });
    } catch {
      res.json({ authenticated: false });
    }
  });

  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(spaPath, 'index.html'));
  });

  // Multer and body-parser errors would otherwise render an HTML stack trace.
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof multer.MulterError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const status = (error as { status?: number }).status;
    res.status(status && status >= 400 && status < 500 ? status : 500).json({ error: 'Request failed' });
  });

  return app;
}

/**
 * multer >= 1.4.5 (busboy 1.x) decodes UTF-8 filenames as latin1, turning
 * "résumé" into "rÃ©sumÃ©". Undo that only when the name is actually mangled.
 */
export function decodeUploadName(name: string): string {
  if (/[^\u0000-\u00ff]/.test(name)) return name;
  const utf8 = Buffer.from(name, 'latin1').toString('utf8');
  return utf8.includes('\uFFFD') ? name : utf8;
}

function sendError(res: express.Response, error: unknown, fallback: string): void {
  const authError = toAuthError(error);
  if (authError) {
    res.status(401).json({ error: authError.message });
    return;
  }
  if (error instanceof PathNotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }
  res.status(500).json({ error: error instanceof Error ? error.message : fallback });
}

export interface StartDashboardOptions {
  port?: number;
  openBrowser?: boolean;
}

export async function startDashboard(options: StartDashboardOptions = {}): Promise<{ url: string }> {
  const resolvedPort = options.port ?? (await findAvailablePort());
  const sessionToken = crypto.randomBytes(32).toString('base64url');
  const app = createDashboardServer({ sessionToken });

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(resolvedPort, LOOPBACK_HOST, () => resolve());
    server.once('error', reject);
  });

  // The key goes in the URL fragment, which browsers never send to servers or
  // put in Referer headers. The dashboard moves it into sessionStorage.
  const url = `http://${LOOPBACK_HOST}:${resolvedPort}/#session=${sessionToken}`;
  console.log(`Dashboard running at ${url}`);
  console.log('This link contains a private session key. Do not share it.');

  if (options.openBrowser) {
    const { default: open } = await import('open');
    open(url).catch(() => {});
  }

  // Surface auth problems at startup instead of on the first click.
  const auth = await loadAuth().catch(() => null);
  if (!auth) {
    console.log('Not signed in yet. Run: justdrive auth login');
  }
  return { url };
}
