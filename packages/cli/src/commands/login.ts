import { Command } from 'commander';
import os from 'os';
import chalk from 'chalk';
import { completeDeviceLogin, requestDeviceCode } from '../api/device-login.js';
import { clearCache } from '../drive/cache.js';
import { resetDriveClient } from '../drive/client.js';

declare const __VERSION__: string;

export const loginCommand = new Command('login')
  .description('Sign in this machine to your justdrive account')
  .option('-n, --name <name>', 'Name for this machine, shown on the website')
  .action(async (options: { name?: string }) => {
    const code = await requestDeviceCode({
      hostname: os.hostname(),
      os: `${os.platform()} ${os.release()}`,
      cliVersion: __VERSION__,
    });

    console.log(`Open ${code.verification_uri_complete || code.verification_uri}`);
    console.log(`and enter this code if it is not filled in: ${chalk.bold(code.user_code)}`);
    console.log('Waiting for approval...');

    const session = await completeDeviceLogin(code, {
      name: options.name,
      cliVersion: __VERSION__,
    });

    await clearCache();
    resetDriveClient();

    console.log(chalk.green(`Signed in as ${session.deviceName}.`));
  });
