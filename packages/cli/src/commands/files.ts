import { Command } from 'commander';
import {
  uploadFile,
  downloadFile,
  listFiles,
  createDirectory,
  moveFile,
  removeFile,
} from '../drive/operations.js';
import { formatTable } from '../output/table.js';
import { withProgress } from '../output/progress.js';
import { formatJson } from '../output/json.js';

export const filesCommand = new Command('files')
  .description('File operations');

filesCommand
  .command('ls')
  .description('List files in a directory')
  .argument('[path]', 'Directory path', '')
  .option('--json', 'Output as JSON')
  .action(async (path: string, options: { json?: boolean }) => {
    try {
      const files = await withProgress('Listing files...', () => listFiles(path));
      if (options.json) {
        console.log(formatJson(files));
      } else {
        console.log(formatTable(files));
      }
    } catch (error) {
      console.error('ls failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

filesCommand
  .command('upload')
  .description('Upload a file')
  .argument('<localPath>', 'Local file path')
  .argument('[drivePath]', 'Destination path in Drive')
  .action(async (localPath: string, drivePath?: string) => {
    try {
      const result = await withProgress('Uploading...', () =>
        uploadFile(localPath, drivePath),
      );
      console.log(`Uploaded: ${result.name} (${result.id})`);
    } catch (error) {
      console.error('Upload failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

filesCommand
  .command('download')
  .description('Download a file')
  .argument('<drivePath>', 'Drive file path')
  .argument('[localPath]', 'Local destination path')
  .action(async (drivePath: string, localPath?: string) => {
    try {
      const result = await withProgress('Downloading...', () =>
        downloadFile(drivePath, localPath),
      );
      console.log(`Downloaded: ${result}`);
    } catch (error) {
      console.error('Download failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

filesCommand
  .command('mkdir')
  .description('Create a directory')
  .argument('<path>', 'Directory path')
  .action(async (path: string) => {
    try {
      const result = await createDirectory(path);
      console.log(`Created directory: ${result.name} (${result.id})`);
    } catch (error) {
      console.error('mkdir failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

filesCommand
  .command('mv')
  .description('Move/rename a file')
  .argument('<source>', 'Source path')
  .argument('<dest>', 'Destination path')
  .action(async (source: string, dest: string) => {
    try {
      const result = await moveFile(source, dest);
      console.log(`Moved to: ${result.name} (${result.id})`);
    } catch (error) {
      console.error('mv failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

filesCommand
  .command('rm')
  .description('Remove a file')
  .argument('<path>', 'File path')
  .action(async (path: string) => {
    try {
      await removeFile(path);
      console.log(`Removed: ${path}`);
    } catch (error) {
      console.error('rm failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
