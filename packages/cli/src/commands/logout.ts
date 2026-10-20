import { Command } from 'commander';
import { runLogout } from '../api/device-login.js';
import { getApiUrl } from '../api/client.js';
import { clearCache } from '../drive/cache.js';
import { resetDriveClient } from '../drive/client.js';
import { pendingCount } from '../logger/outbox.js';

export const logoutCommand = new Command('logout')
  .description('Revoke this machine and delete its local session')
  .action(async () => {
    const queued = await pendingCount();

    const warning = await runLogout();
    await clearCache();
    resetDriveClient();

    if (queued > 0) {
      console.log(`${queued} unsent activity events were discarded.`);
    }
    if (warning) {
      console.log('Signed out on this machine only.');
      console.log(`The server could not be reached: ${warning}`);
      console.log(`Remove this machine at ${getApiUrl()}/devices`);
      process.exitCode = 1;
      return;
    }
    console.log('Signed out.');
  });
