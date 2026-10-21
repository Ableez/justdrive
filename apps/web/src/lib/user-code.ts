import crypto from 'node:crypto';

// No vowels or lookalike characters, so a code read aloud or typed from a
// terminal cannot be ambiguous.
const ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ23456789';
const USER_CODE_LENGTH = 8;
const USER_CODE_GROUPS = 2;
const USER_CODE_GROUP_LENGTH = USER_CODE_LENGTH / USER_CODE_GROUPS;

export function generateUserCode(): string {
  const characters = Array.from(
    { length: USER_CODE_LENGTH },
    () => ALPHABET[crypto.randomInt(ALPHABET.length)],
  );
  const groups: string[] = [];
  for (let i = 0; i < USER_CODE_GROUPS; i += 1) {
    groups.push(characters.slice(i * USER_CODE_GROUP_LENGTH, (i + 1) * USER_CODE_GROUP_LENGTH).join(''));
  }
  return groups.join('-');
}

export function generateDeviceCode(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function isValidUserCodeFormat(value: string): boolean {
  if (value.length !== USER_CODE_LENGTH + 1 || value[4] !== '-') return false;
  const characters = value.replace('-', '');
  return [...characters].every((character) => ALPHABET.includes(character));
}

export function normalizeUserCode(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const groups: string[] = [];
  for (let i = 0; i < USER_CODE_GROUPS; i += 1) {
    groups.push(compact.slice(i * USER_CODE_GROUP_LENGTH, (i + 1) * USER_CODE_GROUP_LENGTH));
  }
  return groups.join('-');
}
