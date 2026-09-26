import { z } from 'zod';

const INT4_MAX = 2_147_483_647;
const CLIENT_EVENT_TYPES = [
  'upload',
  'download',
  'mkdir',
  'mv',
  'rm',
  'share',
  'send',
  'receive',
] as const;

export const deviceCodeRequestSchema = z.object({
  hostname: z.string().max(120).optional(),
  os: z.string().max(120).optional(),
  cli_version: z.string().max(40).optional(),
});

export const tokenRequestSchema = z.discriminatedUnion('grant_type', [
  z.object({
    grant_type: z.literal('device_code'),
    device_code: z.string().min(20).max(200),
  }),
  z.object({
    grant_type: z.literal('refresh_token'),
    refresh_token: z.string().min(20).max(200),
  }),
]);

const eventSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(CLIENT_EVENT_TYPES),
  path: z.string().max(1024).nullish(),
  drive_file_id: z.string().max(128).nullish(),
  bytes: z.number().int().nonnegative().max(INT4_MAX).nullish(),
  status: z.string().max(32).nullish(),
  detail: z.string().max(500).nullish(),
  at: z.string().datetime().optional(),
});

export const eventsRequestSchema = z.object({
  events: z.array(eventSchema).min(1).max(200),
});

export const createTransferSchema = z.object({
  drive_file_id: z.string().min(1).max(128),
  // The receiving machine writes this to disk, so it must be a plain file name
  // rather than a path that can climb out of the download directory.
  name: z
    .string()
    .min(1)
    .max(255)
    .refine(
      (value) => !/[/\\]/.test(value) && value !== '.' && value !== '..' && !value.includes('\0'),
      'name must be a plain file name',
    ),
  to: z.string().min(1).max(120),
  bytes: z.number().int().nonnegative().max(INT4_MAX).optional(),
});

export const renameDeviceSchema = z.object({
  name: z.string().trim().min(1).max(60),
});
