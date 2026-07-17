import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { findAvailablePort } from '@juststore/shared';
import { listFiles, uploadFile, removeFile, shareFile } from '../drive/operations.js';
import { loadTokens } from '../auth/tokens.js';
import { loadConfig } from '../drive/cache.js';
import { getUserEmail, createOAuth2Client } from '../drive/client.js';
import { getActivityLog } from '../logger/index.js';

const upload = multer({ dest: path.join(os.tmpdir(), 'juststore-uploads') });

export function createDashboardServer(): express.Express {
  const app = express();

  app.use(express.json());

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const spaPath = path.resolve(__dirname, './dashboard-spa');
  app.use(express.static(spaPath));

  // OAuth callback
  app.get('/oauth2callback', async (req, res) => {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).send('Missing authorization code');
      return;
    }

    try {
      const port = parseInt(req.socket.localPort?.toString() || '4000', 10);
      const redirectUri = `http://localhost:${port}/oauth2callback`;
      const oauth2Client = await createOAuth2Client(redirectUri);
      const { tokens } = await oauth2Client.getToken(code);

      const { saveTokens } = await import('../auth/tokens.js');
      await saveTokens(tokens);

      res.send('<h1>Authenticated!</h1><p>You can close this tab and return to the dashboard.</p>');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).send(`<h1>Authentication failed</h1><p>${message}</p>`);
    }
  });

  // API: List files
  app.get('/api/files', async (req, res) => {
    try {
      const dirPath = (req.query.path as string) || '';
      const files = await listFiles(dirPath);
      res.json(files);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list files';
      res.status(500).json({ error: message });
    }
  });

  // API: Upload file (multipart)
  app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const drivePath = (req.body.drivePath as string) || undefined;
      const file = await uploadFile(req.file.path, drivePath);

      // Clean up temp file
      fs.unlink(req.file.path, () => {});

      res.json(file);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      res.status(500).json({ error: message });
    }
  });

  // API: Delete file
  app.delete('/api/files', async (req, res) => {
    try {
      const { path: filePath } = req.body;
      if (!filePath) {
        res.status(400).json({ error: 'path is required' });
        return;
      }
      await removeFile(filePath);
      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Delete failed';
      res.status(500).json({ error: message });
    }
  });

  // API: Share file
  app.post('/api/share', async (req, res) => {
    try {
      const { path: filePath, email, role } = req.body;
      if (!filePath) {
        res.status(400).json({ error: 'path is required' });
        return;
      }
      const link = await shareFile(filePath, email, role);
      res.json({ link });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Share failed';
      res.status(500).json({ error: message });
    }
  });

  // API: Activity log
  app.get('/api/activity', async (_req, res) => {
    try {
      const entries = await getActivityLog();
      res.json(entries);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load activity';
      res.status(500).json({ error: message });
    }
  });

  // API: Auth status
  app.get('/api/status', async (_req, res) => {
    try {
      const tokens = await loadTokens();
      const config = await loadConfig();

      if (!tokens) {
        res.json({ authenticated: false });
        return;
      }

      let email = config.userEmail;
      if (!email) {
        try {
          email = await getUserEmail() || undefined;
        } catch {
          // Ignore
        }
      }

      res.json({
        authenticated: true,
        email,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      });
    } catch {
      res.json({ authenticated: false });
    }
  });

  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(spaPath, 'index.html'));
  });

  return app;
}

export async function startDashboard(port?: number) {
  const resolvedPort = port ?? (await findAvailablePort());
  const app = createDashboardServer();
  return new Promise<express.Express>((resolve) => {
    app.listen(resolvedPort, () => {
      console.log(`Dashboard running at http://localhost:${resolvedPort}`);
      resolve(app);
    });
  });
}
