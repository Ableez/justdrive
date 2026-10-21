import { Command } from 'commander';
import chalk from 'chalk';
import { formatRows } from '../output/table.js';
import { getApiUrl, listDevices } from '../api/client.js';

export const devicesCommand = new Command('devices')
  .description('List machines signed in to your account')
  .action(async () => {
    const devices = await listDevices();

    if (devices.length === 0) {
      console.log('No machines yet. Run: justdrive login');
      return;
    }

    console.log(
      formatRows(
        ['Name', 'Last seen'],
        devices.map((device) => [
          device.is_self ? `${device.name} (this machine)` : device.name,
          device.last_seen_at ? device.last_seen_at.slice(0, 16).replace('T', ' ') : 'never',
        ]),
      ),
    );
    console.log(chalk.dim(`Revoke a machine at ${getApiUrl()}/devices`));
  });
