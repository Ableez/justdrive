import { Command } from 'commander';
import { shareFile } from '../drive/operations.js';
import { describeError } from '../output/errors.js';

export const shareCommand = new Command('share')
  .description('Share a file')
  .argument('<path>', 'File path')
  .option('--email <email>', 'Share with specific email')
  .option('--role <role>', 'Permission role (reader, commenter, writer, owner)', 'reader')
  .action(async (path: string, options: { email?: string; role?: string }) => {
    try {
      const result = await shareFile(path, options.email, options.role);
      console.log(`Shared: ${path}`);
      console.log(`Link: ${result}`);
    } catch (error) {
      console.error('share failed:', describeError(error));
      process.exitCode = 1;
      return;
    }
  });
