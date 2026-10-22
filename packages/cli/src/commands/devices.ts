import { Command } from 'commander';
import chalk from 'chalk';
import { getApiUrl, listDevices } from '../api/client.js';

export const devicesCommand = new Command('devices')
  .description('List machines signed in to your account')
  .action(async () => {
    const devices = await listDevices();

    if (devices.length === 0) {
      console.log('No machines yet. Run: justdrive login');
      return;
    }

    const rows = devices.map((device) => ({
      name: device.is_self ? `${device.name} (this machine)` : device.name,
      lastSeen: device.last_seen_at ? device.last_seen_at.slice(0, 16).replace('T', ' ') : 'never',
    }));
    const width = Math.max(4, ...rows.map((row) => row.name.length)) + 2;

    console.log(chalk.bold('Name') + ' '.repeat(Math.max(1, width - 4)) + chalk.bold('Last seen'));
    console.log();
    for (const row of rows) {
      console.log(row.name.padEnd(width) + row.lastSeen);
    }
    console.log();
    console.log(chalk.dim(`Revoke a machine at ${getApiUrl()}/devices`));
  });
