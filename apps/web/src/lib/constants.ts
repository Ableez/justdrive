export { ROOT_FOLDER_NAME } from '@juststore/shared';

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const SIGN_IN_SCOPES = ['openid', 'email', DRIVE_FILE_SCOPE];

export const DEVICE_CODE_TTL_SECONDS = 600;
export const DEVICE_CODE_POLL_INTERVAL_SECONDS = 5;
export const DEVICE_ACCESS_TOKEN_TTL_SECONDS = 3600;
export const DEVICE_REFRESH_TOKEN_TTL_DAYS = 90;
export const WEB_SESSION_TTL_DAYS = 30;
export const TRANSFER_TTL_HOURS = 72;
export const ACCESS_TOKEN_REFRESH_SKEW_MS = 60_000;
