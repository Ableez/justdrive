import { DEFAULT_PORT, JUSTSTORE_ROOT_FOLDER, MAX_PORT_ATTEMPTS } from './constants.js';
import net from 'net';

export function normalizePath(path: string): string {
  const segments = path.split('/').filter((s) => s !== '' && s !== '.');
  if (segments[0] === JUSTSTORE_ROOT_FOLDER) segments.shift();
  return segments.join('/');
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
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

export class JustStoreError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
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
