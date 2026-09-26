import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { TRANSFOLDER_FOLDER } from '@juststore/shared';
import { ackTransfer, createTransfer, fetchTransfers } from '../api/client.js';
import { getDriveClient } from '../drive/client.js';
import { getFileById } from '../drive/resolver.js';
import { ensureDirectory, uploadFile } from '../drive/operations.js';
import { formatRows } from '../output/table.js';
import { logActivity } from '../logger/index.js';

export const sendCommand = new Command('send')
  .description('Upload a file and put it in another machine\'s inbox')
  .argument('<file>', 'Local file to send')
  .requiredOption('-t, --to <device>', 'Target machine name')
  .action(async (file: string, options: { to: string }) => {
    if (!fs.existsSync(file)) {
      console.error(`No such file: ${file}`);
      process.exitCode = 1;
      return;
    }

    // The bytes go straight to Drive; the server only records who should pick
    // them up.
    const parentId = await ensureDirectory(TRANSFOLDER_FOLDER);
    const uploaded = await uploadFile(file, undefined, path.basename(file), parentId);
    const transfer = await createTransfer({
      drive_file_id: uploaded.id,
      name: uploaded.name,
      to: options.to,
      bytes: Number(uploaded.size) || undefined,
    });

    await logActivity({
      operation: 'send',
      path: `${TRANSFOLDER_FOLDER}/${uploaded.name}`,
      driveFileId: uploaded.id,
      bytes: Number(uploaded.size) || undefined,
      status: 'success',
      detail: options.to,
    });

    console.log(chalk.green(`Sent ${uploaded.name} to ${options.to}.`));
    console.log(`Collect it there with: justdrive receive ${transfer.id}`);
  });

export const inboxCommand = new Command('inbox')
  .description('List files other machines sent to this one')
  .action(async () => {
    const transfers = await fetchTransfers(true);

    if (transfers.length === 0) {
      console.log('Inbox is empty.');
      return;
    }

    console.log(
      formatRows(
        ['Id', 'Name', 'Size', 'Sent'],
        transfers.map((transfer) => [
          transfer.id.slice(0, 8),
          transfer.name,
          transfer.bytes ?? '',
          transfer.created_at.slice(0, 16).replace('T', ' '),
        ]),
      ),
    );
    console.log(chalk.dim('Download with: justdrive receive <id>'));
  });

export const receiveCommand = new Command('receive')
  .description('Download files sent to this machine')
  .argument('[id]', 'Transfer id, or "all"')
  .argument('[destination]', 'Local directory', '.')
  .action(async (id: string | undefined, destination: string) => {
    const transfers = await fetchTransfers(true);
    const wanted = id && id !== 'all' ? transfers.filter((t) => t.id.startsWith(id)) : transfers;

    if (wanted.length === 0) {
      console.log(id ? `No pending transfer matching "${id}".` : 'Inbox is empty.');
      return;
    }

    for (const transfer of wanted) {
      const localPath = path.join(destination, transfer.name);
      const file = await getFileById(transfer.drive_file_id);
      await downloadFileById(transfer.drive_file_id, localPath);
      await ackTransfer(transfer.id);

      await logActivity({
        operation: 'receive',
        path: `transfers/${transfer.name}`,
        driveFileId: transfer.drive_file_id,
        bytes: transfer.bytes ?? undefined,
        status: 'success',
        detail: file.name ?? transfer.name,
      });

      console.log(chalk.green(`Received ${transfer.name} -> ${localPath}`));
    }
  });

async function downloadFileById(fileId: string, localPath: string): Promise<void> {
  const drive = await getDriveClient();
  const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  const { pipeline } = await import('stream/promises');
  await pipeline(response.data as NodeJS.ReadableStream, fs.createWriteStream(localPath));
}
