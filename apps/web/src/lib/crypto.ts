import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const SEPARATOR = '.';

export class CryptoError extends Error {}

function loadKeys(): Map<number, Buffer> {
  const raw = process.env.TOKEN_ENCRYPTION_KEYS;
  if (!raw) {
    throw new CryptoError('TOKEN_ENCRYPTION_KEYS is not set');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CryptoError('TOKEN_ENCRYPTION_KEYS must be JSON like {"1":"<base64 key>"}');
  }

  const keys = new Map<number, Buffer>();
  for (const [version, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== 'string') continue;
    const key = Buffer.from(value, 'base64');
    if (key.length !== 32) {
      throw new CryptoError(`TOKEN_ENCRYPTION_KEYS version ${version} must decode to 32 bytes`);
    }
    keys.set(Number(version), key);
  }

  if (keys.size === 0) {
    throw new CryptoError('TOKEN_ENCRYPTION_KEYS has no usable keys');
  }
  return keys;
}

function currentVersion(keys: Map<number, Buffer>): number {
  return Math.max(...keys.keys());
}

function additionalData(version: number, owner: string): Buffer {
  return Buffer.from(`justdrive:v${version}:${owner}`);
}

/** Encrypts with the newest key so rotation only needs the old keys kept around. */
export function seal(plaintext: string, owner: string): string {
  const keys = loadKeys();
  const version = currentVersion(keys);
  const key = keys.get(version)!;
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(additionalData(version, owner));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [
    `v${version}`,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    ciphertext.toString('base64'),
  ].join(SEPARATOR);
}

export function open(payload: string, owner: string): string {
  const keys = loadKeys();
  const [versionPart, ivPart, tagPart, dataPart] = payload.split(SEPARATOR);
  const version = Number(versionPart?.slice(1));

  const key = versionPart && keys.get(version);
  if (!key || !ivPart || !tagPart || !dataPart) {
    throw new CryptoError('Ciphertext is malformed or was written with an unknown key version');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, 'base64'));
  decipher.setAAD(additionalData(version, owner));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));

  try {
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new CryptoError('Ciphertext failed authentication');
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
