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
