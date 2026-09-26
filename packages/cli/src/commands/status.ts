import { Command } from 'commander';
import chalk from 'chalk';
import { fetchDriveToken, getApiUrl, requireSession } from '../api/client.js';
import { flush, pendingCount } from '../logger/outbox.js';

export const statusCommand = new Command('status')
  .description('Show the current session and server reachability')
  .action(async () => {
    const session = await requireSession();
    console.log(`Machine: ${session.deviceName}`);
    if (session.email) console.log(`Account: ${session.email}`);
    // The live URL, which is what every request actually goes to.
    console.log(`Server: ${getApiUrl()}`);

    const pending = await pendingCount();
    if (pending > 0) {
      console.log(chalk.yellow(`${pending} activity events waiting to sync.`));
    }

    try {
      const token = await fetchDriveToken();
      const minutes = Math.max(0, Math.round((token.expiry_date - Date.now()) / 60000));
      console.log(chalk.green(`Drive reachable. Google token good for ${minutes} min.`));
      await flush().catch(() => {});
    } catch (error) {
      console.log(chalk.red(`Drive unavailable: ${(error as Error).message}`));
    }
  });
