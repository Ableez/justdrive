import { ROOT_FOLDER_NAME } from './constants.js';

export function normalizePath(path: string): string {
  const segments = path.split('/').filter((segment) => segment !== '' && segment !== '.');
  if (segments[0] === ROOT_FOLDER_NAME) segments.shift();
  return segments.join('/');
}

export function isAbsolutePath(path: string): boolean {
  return path.startsWith('/');
}
