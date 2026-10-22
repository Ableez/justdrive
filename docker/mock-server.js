const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 4000);
const users = { u1: { devices: new Map(), transfers: [], files: new Map() } };
users.u1.files.set('root', { id: 'root', name: 'root', mimeType: 'application/vnd.google-apps.folder', parents: [], trashed: false, size: null });
const tokens = new Map();
const refreshTokens = new Map();
const deviceCodes = new Map();

function uuid() { return crypto.randomUUID(); }
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); }
function readBody(req) { return new Promise((resolve) => { const chunks=[]; req.on('data',c=>chunks.push(c)); req.on('end',()=>resolve(Buffer.concat(chunks))); }); }
function auth(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer (.+)$/);
  if (!m) return null;
  return tokens.get(m[1]) || null;
}
function device(id, name) { return { id, name, is_self: false, last_seen_at: new Date().toISOString() }; }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method;

  // Device code
  if (method === 'GET' && path === '/r/version') {
    return json(res, 200, { version: '9.9.9' });
  }
  if (method === 'GET' && path === '/r/justdrive.mjs') {
    // Serve the installed binary back as the "latest" for testing.
    const fs = require('fs');
    try {
      const data = fs.readFileSync('/usr/local/bin/justdrive');
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(data);
    } catch (e) {
      json(res, 500, { error: e.message });
    }
    return;
  }
  if (method === 'POST' && path === '/api/cli/device-code') {
    const code = uuid();
    const meta = { hostname: 'machine', deviceCode: code };
    try { const b = JSON.parse((await readBody(req)).toString() || '{}'); meta.hostname = b.hostname || meta.hostname; } catch {}
    deviceCodes.set(code, { hostname: meta.hostname, created: Date.now() });
    return json(res, 200, { device_code: code, user_code: 'ABCD-EFGH', verification_uri: `http://mock:${PORT}/device`, verification_uri_complete: `http://mock:${PORT}/device?code=${code}`, expires_in: 600, interval: 1 });
  }

  // Token
  if (method === 'POST' && path === '/api/cli/token') {
    const body = JSON.parse((await readBody(req)).toString() || '{}');
    if (body.grant_type === 'refresh_token') {
      const info = refreshTokens.get(body.refresh_token);
      if (!info) return json(res, 400, { error: 'invalid_grant' });
      const at = 'at_' + uuid();
      tokens.set(at, { userId: 'u1', deviceId: info.deviceId, deviceName: info.deviceName });
      return json(res, 200, { access_token: at, refresh_token: body.refresh_token, token_type: 'Bearer', expires_in: 3600, device: { id: info.deviceId, name: info.deviceName } });
    }
    const dc = deviceCodes.get(body.device_code);
    if (!dc) return json(res, 400, { error: 'expired_token' });
    const deviceId = 'dev_' + uuid().slice(0,8);
    const deviceName = dc.hostname;
    const at = 'at_' + uuid();
    const rt = 'rt_' + uuid();
    tokens.set(at, { userId: 'u1', deviceId, deviceName });
    refreshTokens.set(rt, { userId: 'u1', deviceId, deviceName });
    users.u1.devices.set(deviceId, { id: deviceId, name: deviceName, revokedAt: null, lastSeen: new Date() });
    deviceCodes.delete(body.device_code);
    return json(res, 200, { access_token: at, refresh_token: rt, token_type: 'Bearer', expires_in: 3600, device: { id: deviceId, name: deviceName } });
  }

  // Authenticated routes
  let info = null;
  if (path.startsWith('/drive/') || path.startsWith('/upload/')) {
    info = { userId: 'u1', deviceId: 'mock', deviceName: 'mock' };
  } else {
    info = auth(req);
    if (!info) return json(res, 401, { error: 'unauthorized' });
  }
  const user = users.u1;

  if (method === 'POST' && path === '/api/cli/drive-token') {
    return json(res, 200, { access_token: 'google-token', expires_at: Date.now() + 3600000, expires_in: 3600, root_folder_id: 'root', email: 'test@example.com' });
  }
  if (method === 'GET' && path === '/api/cli/devices') {
    const devs = [...user.devices.values()].map((d) => ({ id: d.id, name: d.name, is_self: d.id === info.deviceId, last_seen_at: d.lastSeen.toISOString() }));
    return json(res, 200, { devices: devs });
  }
  if (method === 'POST' && path === '/api/cli/logout') {
    user.devices.delete(info.deviceId);
    return json(res, 200, { ok: true });
  }
  if (method === 'POST' && path === '/api/cli/events') { await readBody(req); return json(res, 200, { accepted: 1 }); }
  if (method === 'POST' && path === '/api/cli/transfers') {
    const body = JSON.parse((await readBody(req)).toString() || '{}');
    const target = [...user.devices.values()].find((d) => d.name === body.to && d.id !== info.deviceId);
    if (!target) return json(res, 404, { error: `No active device named "${body.to}"` });
    const id = uuid();
    user.transfers.push({ id, userId: 'u1', fromDeviceId: info.deviceId, toDeviceId: target.id, driveFileId: body.drive_file_id, name: body.name, bytes: body.bytes, status: 'pending', createdAt: new Date() });
    return json(res, 201, { id, status: 'pending' });
  }
  if (method === 'GET' && path === '/api/cli/transfers') {
    const inbox = url.searchParams.get('inbox') === '1';
    let rows = user.transfers;
    if (inbox) rows = rows.filter((t) => t.toDeviceId === info.deviceId && t.status === 'pending');
    else rows = rows.filter((t) => t.fromDeviceId === info.deviceId || t.toDeviceId === info.deviceId);
    rows = rows.sort((a,b) => b.createdAt - a.createdAt).slice(0,100);
    return json(res, 200, { transfers: rows.map((r) => ({ id: r.id, drive_file_id: r.driveFileId, name: r.name, bytes: r.bytes, status: r.status, direction: r.toDeviceId === info.deviceId ? 'in' : 'out', created_at: r.createdAt.toISOString() })) });
  }
  const ackMatch = path.match(/^\/api\/cli\/transfers\/([^/]+)\/ack$/);
  if (method === 'POST' && ackMatch) {
    const t = user.transfers.find((x) => x.id === ackMatch[1]);
    if (t) t.status = 'acked';
    return json(res, 200, { ok: true });
  }

  // Drive API (mock) under /drive/v3 and /upload/drive/v3
  if (path.startsWith('/drive/v3/') || path === '/drive/v3/files' || path.startsWith('/upload/drive/v3/')) {
    return handleDrive(req, res, url, method, path, user);
  }

  json(res, 404, { error: 'not found' });
});

function parseQ(q) {
  let parentId = null, name = null, trashed = false, hasTrashed = false;
  const pm = q.match(/'([^']+)'\s+in\s+parents/);
  if (pm) parentId = pm[1];
  const nm = q.match(/name='((?:\\.|[^'])*)'/);
  if (nm) name = nm[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  const tm = q.match(/trashed=(true|false)/);
  if (tm) { hasTrashed = true; trashed = tm[1] === 'true'; }
  return { parentId, name, trashed, hasTrashed };
}

function handleDrive(req, res, url, method, path, user) {
  const files = user.files;

  // list
  if (method === 'GET' && (path === '/drive/v3/files')) {
    const q = url.searchParams.get('q') || '';
    const { parentId, name, trashed, hasTrashed } = parseQ(q);
    let out = [...files.values()].filter((f) => !f.deleted);
    if (parentId) out = out.filter((f) => (f.parents || []).includes(parentId));
    if (name) out = out.filter((f) => f.name === name);
    if (hasTrashed) out = out.filter((f) => !!f.trashed === trashed);
    return json(res, 200, { files: out.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, size: f.size, modifiedTime: f.modifiedTime, parents: f.parents, trashed: f.trashed, webViewLink: f.webViewLink })) });
  }

  // upload create
  if (method === 'POST' && path === '/upload/drive/v3/files') {
    readBody(req).then((buf) => {
      const ct = req.headers['content-type'] || '';
      const boundary = (ct.match(/boundary=(.+)$/)||[])[1];
      let metadata = {};
      let content = Buffer.alloc(0);
      let mimeType = 'application/octet-stream';
      if (boundary) {
        const text = buf.toString('binary');
        const parts = text.split('--' + boundary);
        for (const part of parts) {
          const [headers, ...rest] = part.split('\r\n\r\n');
          const bodyStr = rest.join('\r\n\r\n').replace(/\r\n$/, '');
          if (/application\/json/i.test(headers)) {
            try { metadata = JSON.parse(bodyStr); } catch {}
          } else if (bodyStr.length > 0) {
            content = Buffer.from(bodyStr, 'binary');
            const m = headers.match(/Content-Type:\s*([^\r\n]+)/i);
            if (m) mimeType = m[1].trim();
          }
        }
      } else {
        try { metadata = JSON.parse(buf.toString()); } catch {}
      }
      const fields = url.searchParams.get('fields');
      const id = 'file_' + uuid().slice(0,8);
      const file = { id, name: metadata.name || 'untitled', mimeType: metadata.mimeType || (mimeType !== 'application/octet-stream' ? mimeType : 'application/octet-stream'), parents: metadata.parents || [], trashed: false, size: String(content.length || metadata.size || 0), modifiedTime: new Date().toISOString(), webViewLink: `http://mock:${PORT}/file/${id}`, content, deleted: false };
      user.files.set(id, file);
      const resp = { id: file.id, name: file.name, mimeType: file.mimeType, size: file.size };
      json(res, 200, resp);
    });
    return;
  }

  // create metadata (folder)
  if (method === 'POST' && path === '/drive/v3/files') {
    readBody(req).then((buf) => {
      const metadata = JSON.parse(buf.toString() || '{}');
      const id = 'file_' + uuid().slice(0,8);
      const file = { id, name: metadata.name, mimeType: metadata.mimeType || 'application/octet-stream', parents: metadata.parents || [], trashed: false, size: metadata.size || null, modifiedTime: new Date().toISOString(), webViewLink: null, content: Buffer.alloc(0), deleted: false };
      user.files.set(id, file);
      json(res, 200, { id: file.id, name: file.name, mimeType: file.mimeType, size: file.size });
    });
    return;
  }

  // match /drive/v3/files/:id
  const m = path.match(/^\/drive\/v3\/files\/([^/]+)$/);
  if (m) {
    const fileId = decodeURIComponent(m[1]);
    const f = files.get(fileId);
    if (!f || f.deleted) { json(res, 404, { error: 'not found' }); return; }

    if (method === 'GET') {
      if (url.searchParams.get('alt') === 'media') {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': f.content.length });
        res.end(f.content);
        return;
      }
      const out = { id: f.id, name: f.name, mimeType: f.mimeType, size: f.size, modifiedTime: f.modifiedTime, parents: f.parents, trashed: f.trashed, webViewLink: f.webViewLink };
      json(res, 200, out);
      return;
    }
    if (method === 'PATCH') {
      readBody(req).then((buf) => {
        let body = {};
        try { body = JSON.parse(buf.toString() || '{}'); } catch {}
        if (body.name) f.name = body.name;
        if (body.trashed !== undefined) f.trashed = body.trashed;
        if (url.searchParams.get('addParents')) {
          const p = url.searchParams.get('addParents');
          if (!f.parents.includes(p)) f.parents.push(p);
        }
        if (url.searchParams.get('removeParents')) {
          const r = url.searchParams.get('removeParents').split(',');
          f.parents = f.parents.filter((p) => !r.includes(p));
        }
        json(res, 200, { id: f.id, name: f.name, mimeType: f.mimeType, size: f.size, parents: f.parents, trashed: f.trashed });
      });
      return;
    }
    if (method === 'DELETE') {
      f.deleted = true;
      json(res, 204, {});
      return;
    }
  }

  // permissions
  const pm = path.match(/^\/drive\/v3\/files\/([^/]+)\/permissions$/);
  if (method === 'POST' && pm) {
    readBody(req).then(() => json(res, 200, {}));
    return;
  }

  json(res, 404, { error: 'not found' });
}

server.listen(PORT, () => console.log(`mock server listening on ${PORT}`));