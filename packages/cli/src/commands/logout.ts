import { Command } from 'commander';
import { runLogout } from '../api/device-login.js';
import { clearCache } from '../drive/cache.js';
import { resetDriveClient } from '../drive/client.js';
import { pendingCount } from '../logger/outbox.js';

export const logoutCommand = new Command('logout')
  .description('Revoke this machine and delete its local session')
  .action(async () => {
    const queued = await pendingCount();

    await runLogout();
    await clearCache();
    resetDriveClient();

    if (queued > 0) {
      console.log(`${queued} unsent activity events were discarded.`);
    }
    console.log('Signed out.');
  });
