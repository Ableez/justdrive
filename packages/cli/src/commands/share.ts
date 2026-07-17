import { Command } from 'commander';
import { shareFile } from '../drive/operations.js';

export const shareCommand = new Command('share')
  .description('Share a file')
  .argument('<path>', 'File path')
  .option('--email <email>', 'Share with specific email')
  .option('--role <role>', 'Permission role (reader, writer, owner)', 'reader')
  .action(async (path: string, options: { email?: string; role?: string }) => {
    try {
      const result = await shareFile(path, options.email, options.role);
      console.log(`Shared: ${path}`);
      console.log(`Link: ${result}`);
    } catch (error) {
      console.error('share failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
