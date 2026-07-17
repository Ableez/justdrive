import Table from 'cli-table3';
import { DriveFile } from '@juststore/shared';

export function formatTable(files: DriveFile[]): string {
  if (files.length === 0) return 'No files found.';

  const table = new Table({
    head: ['Name', 'Type', 'Size', 'Modified'],
    colWidths: [40, 30, 15, 25],
  });

  for (const file of files) {
    table.push([
      file.name,
      formatMimeType(file.mimeType),
      file.size ? formatSize(Number(file.size)) : '-',
      file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : '-',
    ]);
  }

  return table.toString();
}

function formatMimeType(mimeType: string): string {
  if (mimeType === 'application/vnd.google-apps.folder') return 'folder';
  const parts = mimeType.split('/');
  return parts[parts.length - 1];
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
