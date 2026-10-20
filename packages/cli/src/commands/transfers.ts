import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { TRANSFOLDER_FOLDER, JustStoreError } from '@juststore/shared';
import { ackTransfer, createTransfer, fetchTransfers, type RemoteTransfer } from '../api/client.js';
import { getDriveClient } from '../drive/client.js';
import { ensureDirectory, uploadFile } from '../drive/operations.js';
import { formatRows } from '../output/table.js';
import { logActivity } from '../logger/index.js';

export const sendCommand = new Command('send')
  .description("Upload a file and put it in another machine's inbox")
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

    let transfer: { id: string };
    try {
      transfer = await createTransfer({
        drive_file_id: uploaded.id,
        name: uploaded.name,
        to: options.to,
        bytes: Number(uploaded.size) || undefined,
      });
    } catch (error) {
      // Nothing points at the file now, so remove it rather than orphaning it
      // in Drive with no record anywhere.
      const drive = await getDriveClient();
      await Promise.resolve(drive.files.delete({ fileId: uploaded.id })).catch(() => {});
      throw error;
    }

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
  .argument('[id]', 'Id shown by justdrive inbox, or "all"')
  .argument('[destination]', 'Local directory', '.')
  .action(async (id: string | undefined, destination: string) => {
    const transfers = await fetchTransfers(true);
    const wanted = selectTransfers(transfers, id);

    if (wanted.length === 0) {
      console.log(id ? `No pending transfer matching "${id}".` : 'Inbox is empty.');
      return;
    }

    for (const transfer of wanted) {
      let localPath: string;
      try {
        localPath = path.join(destination, safeFileName(transfer));
        await downloadFileById(transfer.drive_file_id, localPath);
      } catch (error) {
        console.error(`Skipped ${transfer.name}: ${(error as Error).message}`);
        continue;
      }

      console.log(chalk.green(`Received ${transfer.name} -> ${localPath}`));

      // The bytes are already safe on disk, so a failed ack must not look like
      // a failed download or skip the rest of the inbox.
      try {
        await ackTransfer(transfer.id);
      } catch {
        console.log(chalk.dim('  (not acknowledged; it will be offered again)'));
      }

      await logActivity({
        operation: 'receive',
        path: `${TRANSFOLDER_FOLDER}/${transfer.name}`,
        driveFileId: transfer.drive_file_id,
        bytes: transfer.bytes ?? undefined,
        status: 'success',
      });
    }
  });

function selectTransfers(transfers: RemoteTransfer[], id: string | undefined): RemoteTransfer[] {
  if (!id || id === 'all') return transfers;

  const matches = transfers.filter((transfer) => transfer.id.startsWith(id));
  if (matches.length > 1) {
    // A one-character prefix matches a surprising number of ids, and
    // overwriting same-named files silently is worse than asking.
    console.error(
      `"${id}" matches ${matches.length} transfers: ${matches.map((t) => t.id.slice(0, 8)).join(', ')}`,
    );
    return [];
  }
  return matches;
}

/** A name arrives from the server and becomes a path, so it must not be one. */
function safeFileName(transfer: RemoteTransfer): string {
  const name = path.basename(transfer.name);
  if (!name || name === '.' || name === '..' || name !== transfer.name) {
    throw new JustStoreError(`Unsafe transfer name: ${transfer.name}`, 'INVALID_PATH');
  }
  return name;
}

async function downloadFileById(fileId: string, localPath: string): Promise<void> {
  const drive = await getDriveClient();
  const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  const { pipeline } = await import('stream/promises');
  const partial = `${localPath}.part`;

  await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
  try {
    await pipeline(response.data as NodeJS.ReadableStream, fs.createWriteStream(partial));
    await fs.promises.rename(partial, localPath);
  } catch (error) {
    await fs.promises.rm(partial, { force: true });
    throw error;
  }
}
