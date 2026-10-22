import { Command } from 'commander';
import { describeError } from './output/errors.js';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { statusCommand } from './commands/status.js';
import { devicesCommand } from './commands/devices.js';
import {
  filesCommand,
  lsCommand,
  uploadCommand,
  downloadCommand,
  mkdirCommand,
  mvCommand,
  rmCommand,
} from './commands/files.js';
import { shareCommand } from './commands/share.js';
import { sendCommand, inboxCommand, receiveCommand } from './commands/transfers.js';
import { updateCommand, checkForUpdate } from './commands/update.js';

declare const __VERSION__: string;

const program = new Command();

program
  .name(process.argv[1]?.endsWith('jd') ? 'jd' : 'justdrive')
  .description('Move files between machines through your Google Drive')
  .version(__VERSION__);

program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(statusCommand);
program.addCommand(devicesCommand);
program.addCommand(filesCommand);
program.addCommand(lsCommand);
program.addCommand(uploadCommand);
program.addCommand(downloadCommand);
program.addCommand(mkdirCommand);
program.addCommand(mvCommand);
program.addCommand(rmCommand);
program.addCommand(shareCommand);
program.addCommand(sendCommand);
program.addCommand(inboxCommand);
program.addCommand(receiveCommand);
program.addCommand(updateCommand);

void checkForUpdate().catch(() => {});

program.parseAsync().catch((error) => {
  console.error(describeError(error));
  process.exitCode = 1;
});
