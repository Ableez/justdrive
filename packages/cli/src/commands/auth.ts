import { Command } from 'commander';
import { runAuthLogin, runAuthLogout } from '../auth/flow.js';

export const authCommand = new Command('auth')
  .description('Authentication commands');

authCommand
  .command('login')
  .description('Authenticate with Google Drive')
  .action(async () => {
    try {
      await runAuthLogin();
    } catch (error) {
      console.error('Login failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

authCommand
  .command('logout')
  .description('Revoke stored credentials')
  .action(async () => {
    try {
      await runAuthLogout();
    } catch (error) {
      console.error('Logout failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
