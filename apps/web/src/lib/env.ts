function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export function googleClientId(): string {
  return required('GOOGLE_CLIENT_ID');
}

export function googleClientSecret(): string {
  return required('GOOGLE_CLIENT_SECRET');
}

export function baseUrl(): string {
  return process.env.JUSTDRIVE_BASE_URL || 'http://localhost:3000';
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
