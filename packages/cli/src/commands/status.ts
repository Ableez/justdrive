import { Command } from 'commander';
import { DRIVE_SCOPE } from '@juststore/shared';
import { loadAuth, saveAuth } from '../auth/tokens.js';
import { describeError } from '../auth/errors.js';
import { loadConfig } from '../drive/cache.js';
import { fetchAccountEmail, getAuthenticatedClient } from '../drive/client.js';
import chalk from 'chalk';

export const statusCommand = new Command('status')
  .description('Show current status')
  .action(async () => {
    try {
      const auth = await loadAuth();

      if (!auth) {
        console.log(chalk.red('Not authenticated. Run: justdrive auth login'));
        return;
      }

      // Access tokens expire hourly and are refreshed automatically, so the
      // only meaningful check is whether Google still accepts the login.
      let email = auth.email ?? null;
      try {
        email = (await fetchAccountEmail(await getAuthenticatedClient())) ?? email;
        console.log(chalk.green('Authenticated'));
      } catch (error) {
        console.log(chalk.red('Session invalid: ') + describeError(error));
        return;
      }

      if (email && email !== auth.email) {
        const latest = (await loadAuth()) ?? auth;
        await saveAuth({ ...latest, email });
      }
      if (email) console.log(`User: ${email}`);

      const fullAccess = auth.scopes.includes(DRIVE_SCOPE);
      console.log(`Access: ${fullAccess ? 'entire Google Drive' : 'files created by justdrive'}`);
      if (!auth.tokens.refresh_token) {
        console.log(chalk.yellow('No refresh token saved; you will need to log in again when this session expires.'));
      }

      const config = await loadConfig();
      if (config.rootFolderId) {
        console.log(`Root folder ID: ${config.rootFolderId}`);
      }
    } catch (error) {
      console.error('Status check failed:', describeError(error));
      process.exit(1);
    }
  });
