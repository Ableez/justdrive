export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string | null;
  modifiedTime?: string | null;
  createdTime?: string | null;
  thumbnailLink?: string | null;
  webViewLink?: string | null;
  parents?: string[];
  shared?: boolean;
  trashed?: boolean;
}

export interface ActivityLogEntry {
  timestamp: string;
  operation: 'upload' | 'download' | 'mkdir' | 'mv' | 'rm' | 'share' | 'login' | 'logout';
  path: string;
  status: 'success' | 'error';
  detail?: string;
}

export interface OAuthTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  token_type?: string | null;
  scope?: string;
  id_token?: string | null;
}

export interface StoredAuth {
  version: 1;
  clientId: string;
  scopes: string[];
  email?: string | null;
  tokens: OAuthTokens;
}

export interface Config {
  rootFolderId?: string;
  userEmail?: string;
}
