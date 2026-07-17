import { Command } from 'commander';
import { startDashboard } from '../server/index.js';

export const dashboardCommand = new Command('dashboard')
  .description('Start the companion dashboard')
  .option('-p, --port <port>', 'Port to listen on')
  .action(async (options: { port?: string }) => {
    try {
      const port = options.port ? parseInt(options.port, 10) : undefined;
      await startDashboard(port);
    } catch (error) {
      console.error('Dashboard failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
