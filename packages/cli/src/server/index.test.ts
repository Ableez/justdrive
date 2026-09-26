import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';

vi.mock('../drive/operations.js', () => ({
  listFiles: vi.fn(),
  uploadFile: vi.fn(),
  removeFile: vi.fn(),
  shareFile: vi.fn(),
}));

vi.mock('../auth/tokens.js', () => ({
  loadAuth: vi.fn(),
}));

vi.mock('open', () => ({ default: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../logger/index.js', () => ({
  getActivityLog: vi.fn(),
}));

import { createDashboardServer, decodeUploadName, startDashboard, SESSION_HEADER } from './index.js';
import open from 'open';
import net from 'net';
import { listFiles, uploadFile, removeFile, shareFile } from '../drive/operations.js';
import { loadAuth } from '../auth/tokens.js';
import { getActivityLog } from '../logger/index.js';
import { DRIVE_SCOPE, PathNotFoundError } from '@juststore/shared';

const TOKEN = 'test-session-token-0123456789abcdef';

describe('server/index', () => {
  let server: http.Server;
  let base: string;

  beforeAll(async () => {
    const app = createDashboardServer({ sessionToken: TOKEN });
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const api = (path: string, init: RequestInit = {}) =>
    fetch(`${base}${path}`, {
      ...init,
      headers: { [SESSION_HEADER]: TOKEN, ...(init.headers as Record<string, string>) },
    });

  /** fetch() won't let us override Host, so use raw http for rebinding tests. */
  function rawGet(path: string, headers: Record<string, string>): Promise<number> {
    return new Promise((resolve, reject) => {
      const req = http.get(`${base}${path}`, { headers }, (res) => {
        res.resume();
        resolve(res.statusCode!);
      });
      req.on('error', reject);
    });
  }

  describe('access control', () => {
    it('rejects API requests without the session key', async () => {
      const res = await fetch(`${base}/api/files`);
      expect(res.status).toBe(401);
      expect(listFiles).not.toHaveBeenCalled();
    });

    it('rejects API requests with a wrong session key', async () => {
      const res = await fetch(`${base}/api/files`, { headers: { [SESSION_HEADER]: 'wrong' } });
      expect(res.status).toBe(401);
    });

    it('rejects a cross-site form upload (CSRF) since forms cannot set headers', async () => {
      const form = new FormData();
      form.append('file', new Blob(['x']), 'x.txt');
      const res = await fetch(`${base}/api/upload`, { method: 'POST', body: form });
      expect(res.status).toBe(401);
      expect(uploadFile).not.toHaveBeenCalled();
    });

    it('rejects requests for foreign Host headers (DNS rebinding)', async () => {
      expect(await rawGet('/api/files', { host: 'evil.example:4000', [SESSION_HEADER]: TOKEN })).toBe(403);
      expect(await rawGet('/', { host: 'evil.example' })).toBe(403);
    });

    it('accepts localhost Host headers', async () => {
      vi.mocked(listFiles).mockResolvedValue([]);
      expect(await rawGet('/api/files', { host: 'localhost:4000', [SESSION_HEADER]: TOKEN })).toBe(200);
    });

    it('sets security headers', async () => {
      const res = await fetch(`${base}/api/status`);
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
      expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
      expect(res.headers.get('x-powered-by')).toBeNull();
    });

    it('no longer exposes an OAuth callback that could plant foreign tokens', async () => {
      await api('/oauth2callback?code=attacker');
      expect(loadAuth).not.toHaveBeenCalled();
    });
  });

  describe('routes', () => {
    it('lists files', async () => {
      vi.mocked(listFiles).mockResolvedValue([{ id: '1', name: 'a', mimeType: 'text/plain' }]);
      const res = await api('/api/files?path=docs');
      expect(res.status).toBe(200);
      expect(listFiles).toHaveBeenCalledWith('docs');
    });

    it('maps auth failures to 401 and missing paths to 404', async () => {
      vi.mocked(listFiles).mockRejectedValueOnce(new Error('invalid_grant'));
      const authRes = await api('/api/files');
      expect(authRes.status).toBe(401);
      expect(((await authRes.json()) as { error: string }).error).toMatch(/auth login/);

      vi.mocked(listFiles).mockRejectedValueOnce(new PathNotFoundError('nope'));
      expect((await api('/api/files?path=nope')).status).toBe(404);
    });

    it('uploads using the original UTF-8 filename, not the temp name', async () => {
      vi.mocked(uploadFile).mockResolvedValue({ id: '1', name: 'résumé.pdf', mimeType: 'application/pdf' });
      const form = new FormData();
      form.append('file', new Blob(['data']), 'résumé.pdf');
      form.append('drivePath', 'docs');

      const res = await api('/api/upload', { method: 'POST', body: form });

      expect(res.status).toBe(200);
      expect(uploadFile).toHaveBeenCalledWith(expect.any(String), 'docs', 'résumé.pdf');
    });

    it('rejects multi-file uploads with a JSON error', async () => {
      const form = new FormData();
      form.append('file', new Blob(['a']), 'a.txt');
      form.append('file', new Blob(['b']), 'b.txt');
      const res = await api('/api/upload', { method: 'POST', body: form });
      expect(res.status).toBe(400);
      expect(uploadFile).not.toHaveBeenCalled();
    });

    it('returns Drive failures as JSON errors', async () => {
      vi.mocked(uploadFile).mockRejectedValueOnce(new Error('quota exceeded'));
      const form = new FormData();
      form.append('file', new Blob(['a']), 'a.txt');
      const up = await api('/api/upload', { method: 'POST', body: form });
      expect(up.status).toBe(500);
      expect(await up.json()).toEqual({ error: 'quota exceeded' });

      vi.mocked(removeFile).mockRejectedValueOnce('non-error');
      const del = await api('/api/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'a' }),
      });
      expect(await del.json()).toEqual({ error: 'Delete failed' });

      vi.mocked(shareFile).mockRejectedValueOnce(new Error('nope'));
      const share = await api('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'a' }),
      });
      expect(share.status).toBe(500);
      expect(shareFile).toHaveBeenCalledWith('a', undefined, 'reader');
    });

    it('requires a path to delete', async () => {
      const res = await api('/api/files', { method: 'DELETE' });
      expect(res.status).toBe(400);
      expect(removeFile).not.toHaveBeenCalled();
    });

    it('serves the activity log', async () => {
      vi.mocked(getActivityLog).mockResolvedValueOnce([]);
      expect(await (await api('/api/activity')).json()).toEqual([]);
      vi.mocked(getActivityLog).mockRejectedValueOnce(new Error('disk'));
      expect((await api('/api/activity')).status).toBe(500);
    });

    it('treats an unreadable login as signed out', async () => {
      vi.mocked(loadAuth).mockRejectedValueOnce(new Error('corrupted'));
      expect(await (await api('/api/status')).json()).toEqual({ authenticated: false });
    });

    it('requires a file for uploads', async () => {
      const res = await api('/api/upload', { method: 'POST', body: new FormData() });
      expect(res.status).toBe(400);
    });

    it('deletes (trashes) a file', async () => {
      const res = await api('/api/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'a.txt' }),
      });
      expect(res.status).toBe(200);
      expect(removeFile).toHaveBeenCalledWith('a.txt');
    });

    it('validates share input and never allows ownership transfer', async () => {
      const post = (body: unknown) =>
        api('/api/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

      expect((await post({})).status).toBe(400);
      expect((await post({ path: 'a', email: 'not-an-email' })).status).toBe(400);
      expect((await post({ path: 'a', email: 'x@y.com', role: 'owner' })).status).toBe(400);
      expect(shareFile).not.toHaveBeenCalled();

      vi.mocked(shareFile).mockResolvedValue('https://link');
      const ok = await post({ path: 'a', email: 'x@y.com', role: 'writer' });
      expect(await ok.json()).toEqual({ link: 'https://link' });
    });

    it('returns malformed JSON as a JSON 400, not an HTML stack trace', async () => {
      const res = await api('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{bad',
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Request failed' });
    });

    it('reports status from the saved login', async () => {
      vi.mocked(loadAuth).mockResolvedValue({
        version: 1,
        clientId: 'c',
        scopes: [DRIVE_SCOPE],
        email: 'me@test.com',
        tokens: { access_token: 'secret-token' },
      });
      const res = await api('/api/status');
      const body = await res.json();
      expect(body).toEqual({ authenticated: true, email: 'me@test.com', fullAccess: true });
      expect(JSON.stringify(body)).not.toContain('secret-token');

      vi.mocked(loadAuth).mockResolvedValue(null);
      expect(await (await api('/api/status')).json()).toEqual({ authenticated: false });
    });
  });

  it('decodeUploadName repairs latin1-mangled names and leaves good ones alone', () => {
    expect(decodeUploadName('rÃ©sumÃ©.pdf')).toBe('résumé.pdf');
    expect(decodeUploadName('résumé.pdf')).toBe('résumé.pdf');
    expect(decodeUploadName('日本.txt')).toBe('日本.txt');
    expect(decodeUploadName('plain.txt')).toBe('plain.txt');
  });

  describe('startDashboard', () => {
    it('binds to loopback only and prints a URL carrying the session key in the fragment', async () => {
      const port = await new Promise<number>((resolve) => {
        const srv = net.createServer().listen(0, '127.0.0.1', () => {
          const p = (srv.address() as AddressInfo).port;
          srv.close(() => resolve(p));
        });
      });
      vi.mocked(loadAuth).mockResolvedValue(null);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { url } = await startDashboard({ port, openBrowser: true });

      expect(url).toMatch(new RegExp(`^http://127\\.0\\.0\\.1:${port}/#session=[\\w-]{43}$`));
      expect(open).toHaveBeenCalledWith(url);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Not signed in'));

      const key = url.split('#session=')[1];
      const ok = await fetch(`http://127.0.0.1:${port}/api/status`, { headers: { [SESSION_HEADER]: key } });
      expect(ok.status).toBe(200);
      const denied = await fetch(`http://127.0.0.1:${port}/api/status`);
      expect(denied.status).toBe(401);
      logSpy.mockRestore();
    });
  });
});
