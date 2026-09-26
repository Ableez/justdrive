import { Command } from 'commander';
import { runAuthLogin, runAuthLogout } from '../auth/flow.js';
import { describeError } from '../auth/errors.js';
import { importCredentialsFile, getClientFilePath } from '../config/credentials.js';

export const authCommand = new Command('auth')
  .description('Authentication commands');

authCommand
  .command('login')
  .description('Authenticate with Google Drive')
  .option('--full-access', 'Request access to your entire Drive instead of only files justdrive creates')
  .option('--no-browser', 'Print the sign-in URL instead of opening a browser')
  .option('-p, --port <port>', 'Preferred port for the local sign-in callback')
  .action(async (options: { fullAccess?: boolean; browser?: boolean; port?: string }) => {
    try {
      await runAuthLogin({
        fullAccess: options.fullAccess,
        openBrowser: options.browser,
        port: options.port ? parseInt(options.port, 10) : undefined,
      });
    } catch (error) {
      console.error('Login failed:', describeError(error));
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
      console.error('Logout failed:', describeError(error));
      process.exit(1);
    }
  });

authCommand
  .command('setup')
  .description('Use your own Google OAuth "Desktop app" client')
  .argument('<clientFile>', 'Path to the client_secret_*.json downloaded from Google Cloud Console')
  .action(async (clientFile: string) => {
    try {
      const creds = await importCredentialsFile(clientFile);
      console.log(`Saved OAuth client ${creds.clientId} to ${getClientFilePath()}`);
      console.log('You can delete the downloaded file. Next, run: justdrive auth login');
    } catch (error) {
      console.error('Setup failed:', describeError(error));
      process.exit(1);
    }
  });
