import crypto from 'node:crypto';

process.env.TOKEN_ENCRYPTION_KEYS = JSON.stringify({
  1: crypto.randomBytes(32).toString('base64'),
});
process.env.JUSTDRIVE_BASE_URL = 'http://localhost:3000';
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
