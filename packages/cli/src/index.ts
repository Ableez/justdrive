import { Command } from 'commander';
import { authCommand } from './commands/auth.js';
import { filesCommand } from './commands/files.js';
import { shareCommand } from './commands/share.js';
import { statusCommand } from './commands/status.js';
import { dashboardCommand } from './commands/dashboard.js';

declare const __VERSION__: string;

const program = new Command();

program
  .name('justdrive')
  .description('CLI tool for Google Drive file management')
  .version(__VERSION__);

program.addCommand(authCommand);
program.addCommand(filesCommand);
program.addCommand(shareCommand);
program.addCommand(statusCommand);
program.addCommand(dashboardCommand);

program.parse();
