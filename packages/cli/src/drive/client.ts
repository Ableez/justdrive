import crypto from 'node:crypto';
import { fetchDriveToken } from '../api/client.js';

const DRIVE_API_BASE = (process.env.JUSTDRIVE_DRIVE_API_URL || 'https://www.googleapis.com').replace(
  /\/$/,
  '',
);

let accessToken: string | null = null;
let tokenExpiresAt = 0;
let driveClient: any = null;

async function getAccessToken(force = false): Promise<string> {
  if (!force && accessToken && Date.now() < tokenExpiresAt - 60_000) {
    return accessToken;
  }
  const token = await fetchDriveToken();
  accessToken = token.access_token;
  tokenExpiresAt = token.expiry_date;
  return accessToken;
}

export function resetDriveClient(): void {
  accessToken = null;
  tokenExpiresAt = 0;
  driveClient = null;
}

async function driveFetch(
  method: string,
  url: string,
  headers: Record<string, string> = {},
  body?: string | Buffer,
): Promise<Response> {
  let token = await getAccessToken();
  let response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...headers },
    body,
  });
  if (response.status === 401) {
    accessToken = null;
    tokenExpiresAt = 0;
    token = await getAccessToken(true);
    response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...headers },
      body,
    });
  }
  return response;
}

function apiUrl(path: string, params?: Record<string, string | undefined>): string {
  const url = new URL(`${DRIVE_API_BASE}/drive/v3${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function uploadUrl(params?: Record<string, string | undefined>): string {
  const url = new URL(`${DRIVE_API_BASE}/upload/drive/v3/files`);
  url.searchParams.set('uploadType', 'multipart');
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

async function throwOnError(response: Response): Promise<void> {
  if (response.ok) return;
  const text = await response.text().catch(() => '');
  throw new Error(`Drive API ${response.status}: ${text.slice(0, 200)}`);
}

export async function getDriveClient(): Promise<any> {
  if (driveClient) return driveClient;
  driveClient = {
    files: {
      async list(params: any) {
        const response = await driveFetch('GET', apiUrl('/files', {
          q: params.q,
          fields: params.fields,
          spaces: params.spaces,
          orderBy: params.orderBy,
          pageToken: params.pageToken,
        }));
        await throwOnError(response);
        return { data: await response.json() };
      },
      async get(params: any, _options?: any) {
        const response = await driveFetch('GET', apiUrl(`/files/${encodeURIComponent(params.fileId)}`, {
          alt: params.alt,
          fields: params.fields,
        }));
        await throwOnError(response);
        if (params.alt === 'media') {
          const { Readable } = await import('node:stream');
          return { data: Readable.fromWeb(response.body as any) };
        }
        return { data: await response.json() };
      },
      async create(params: any) {
        const metadata = params.requestBody || {};
        const fields = params.fields;
        if (!params.media) {
          const response = await driveFetch('POST', apiUrl('/files', { fields }), {
            'Content-Type': 'application/json',
          }, JSON.stringify(metadata));
          await throwOnError(response);
          return { data: await response.json() };
        }
        const chunks: Buffer[] = [];
        for await (const chunk of params.media.body) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const fileBuffer = Buffer.concat(chunks);
        const boundary = `justdrive_${crypto.randomUUID()}`;
        const mimeType = params.media.mimeType || 'application/octet-stream';
        const body = Buffer.concat([
          Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
          Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
          fileBuffer,
          Buffer.from(`\r\n--${boundary}--`),
        ]);
        const response = await driveFetch('POST', uploadUrl({ fields }), {
          'Content-Type': `multipart/related; boundary=${boundary}`,
        }, body);
        await throwOnError(response);
        return { data: await response.json() };
      },
      async update(params: any) {
        const search: Record<string, string | undefined> = {
          fields: params.fields,
          addParents: params.addParents,
          removeParents: params.removeParents,
        };
        const hasBody = params.requestBody !== undefined;
        const response = await driveFetch('PATCH', apiUrl(`/files/${encodeURIComponent(params.fileId)}`, search), hasBody
          ? { 'Content-Type': 'application/json' }
          : {}, hasBody ? JSON.stringify(params.requestBody) : undefined);
        await throwOnError(response);
        const text = await response.text();
        return { data: text ? JSON.parse(text) : {} };
      },
      async delete(params: any) {
        const response = await driveFetch('DELETE', apiUrl(`/files/${encodeURIComponent(params.fileId)}`));
        if (!response.ok && response.status !== 204) await throwOnError(response);
        return { data: {} };
      },
    },
    permissions: {
      async create(params: any) {
        const response = await driveFetch('POST', apiUrl(`/files/${encodeURIComponent(params.fileId)}/permissions`, {
          transferOwnership: params.transferOwnership ? String(params.transferOwnership) : undefined,
        }), { 'Content-Type': 'application/json' }, JSON.stringify(params.requestBody || {}));
        await throwOnError(response);
        return { data: await response.json() };
      },
    },
  };
  return driveClient;
}