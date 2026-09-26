export const JUSTSTORE_ROOT_FOLDER = 'juststore';
export const DEFAULT_PORT = 4000;
// Local servers bind here only, never to all interfaces.
export const LOOPBACK_HOST = '127.0.0.1';
export const MAX_PORT_ATTEMPTS = 100;
export const CONFIG_DIR = '.juststore';
export const TOKEN_FILE = 'token.json';
export const CLIENT_FILE = 'client.json';
export const CACHE_FILE = 'cache.json';
export const ACTIVITY_LOG_FILE = 'activity.json';
// Full Drive access. Restricted scope: requires Google verification before
// anyone outside the OAuth consent screen's test users can sign in.
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
// Access only to files this app created or opened. Non-sensitive scope, so it
// works for any Google account without a security assessment.
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const AUTH_TIMEOUT_MS = 5 * 60 * 1000;
export const DRIVE_FIELDS =
  'id, name, mimeType, size, modifiedTime, createdTime, thumbnailLink, webViewLink, parents, shared, trashed';
