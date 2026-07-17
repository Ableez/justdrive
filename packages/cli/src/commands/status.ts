import { Command } from 'commander';
import { loadTokens } from '../auth/tokens.js';
import { loadConfig, setCachedPath } from '../drive/cache.js';
import { getUserEmail } from '../drive/client.js';
import chalk from 'chalk';

export const statusCommand = new Command('status')
  .description('Show current status')
  .action(async () => {
    try {
      const tokens = await loadTokens();
      const config = await loadConfig();

      if (!tokens) {
        console.log(chalk.red('Not authenticated. Run: juststore auth login'));
        return;
      }

      console.log(chalk.green('Authenticated'));

      // Fetch and cache email if not already cached
      if (!config.userEmail) {
        const email = await getUserEmail();
        if (email) {
          await setCachedPath('__user_email__', email);
          console.log(`User: ${email}`);
        }
      } else {
        console.log(`User: ${config.userEmail}`);
      }

      if (config.rootFolderId) {
        console.log(`Root folder ID: ${config.rootFolderId}`);
      }

      if (tokens.expiry_date) {
        const expiresAt = new Date(tokens.expiry_date);
        const isExpired = expiresAt < new Date();
        console.log(
          `Token expires: ${expiresAt.toISOString()} ${isExpired ? chalk.red('(EXPIRED)') : chalk.green('(valid)')}`,
        );
      }
    } catch (error) {
      console.error('Status check failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
