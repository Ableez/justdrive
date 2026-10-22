import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/** How a user's Google connection is currently doing. */
export const connectionStatus = pgEnum('connection_status', ['active', 'revoked', 'error']);

export const deviceTokenKind = pgEnum('device_token_kind', ['refresh', 'access']);

export const deviceAuthStatus = pgEnum('device_auth_status', [
  'pending',
  'approved',
  'denied',
  'expired',
]);

export const transferStatus = pgEnum('transfer_status', ['pending', 'delivered', 'expired']);

export const eventType = pgEnum('event_type', [
  // Reported by the CLI
  'upload',
  'download',
  'mkdir',
  'mv',
  'rm',
  'share',
  'send',
  'receive',
  // Recorded by the server, so it cannot be forged by a client
  'login',
  'device_approved',
  'device_revoked',
  'drive_token_issued',
  'device_token_reuse',
  'google_connected',
  'google_disconnected',
  'account_deleted',
]);

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    googleSub: text('google_sub').notNull(),
    email: text('email').notNull(),
    // The single justdrive root folder. Owned by the server so every machine
    // addresses the same tree, instead of each one finding its own.
    driveRootFolderId: text('drive_root_folder_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('users_google_sub_idx').on(table.googleSub)],
);

export const googleConnections = pgTable('google_connections', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenEnc: text('refresh_token_enc').notNull(),
  keyVersion: integer('key_version').notNull().default(1),
  scopes: text('scopes').array().notNull(),
  status: connectionStatus('status').notNull().default('active'),
  accessTokenEnc: text('access_token_enc'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
  lastRefreshedAt: timestamp('last_refreshed_at', { withTimezone: true }),
  lastError: text('last_error'),
});

/** Browser sessions. Only the hash of the id is stored. */
export const webSessions = pgTable(
  'web_sessions',
  {
    idHash: text('id_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (table) => [index('web_sessions_user_idx').on(table.userId)],
);

export const devices = pgTable(
  'devices',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    hostname: text('hostname'),
    os: text('os'),
    cliVersion: text('cli_version'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    lastIp: text('last_ip'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    index('devices_user_idx').on(table.userId),
    uniqueIndex('devices_user_name_idx').on(table.userId, table.name),
  ],
);

export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: text('id').primaryKey(),
    deviceId: text('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    kind: deviceTokenKind('kind').notNull(),
    tokenHash: text('token_hash').notNull(),
    /**
     * Rotating refresh tokens form a chain. Reusing a spent one means it leaked,
     * so the whole family can be revoked at once.
     */
    familyId: text('family_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('device_tokens_hash_idx').on(table.tokenHash),
    index('device_tokens_device_idx').on(table.deviceId),
    index('device_tokens_family_idx').on(table.familyId),
  ],
);

/** RFC 8628 device authorization requests, keyed by hashed device code. */
export const deviceAuthRequests = pgTable(
  'device_auth_requests',
  {
    deviceCodeHash: text('device_code_hash').primaryKey(),
    userCode: text('user_code').notNull(),
    hostname: text('hostname'),
    os: text('os'),
    cliVersion: text('cli_version'),
    requestIp: text('request_ip'),
    status: deviceAuthStatus('status').notNull().default('pending'),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    deviceId: text('device_id').references(() => devices.id, { onDelete: 'set null' }),
    deviceName: text('device_name'),
    lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),
    pollCount: integer('poll_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex('device_auth_user_code_idx').on(table.userCode)],
);

/**
 * Activity history. `id` is generated by the client so a queued event can be
 * replayed after being offline without creating a duplicate row.
 */
export const events = pgTable(
  'events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: text('device_id').references(() => devices.id, { onDelete: 'set null' }),
    type: eventType('type').notNull(),
    path: text('path'),
    driveFileId: text('drive_file_id'),
    bytes: integer('bytes'),
    status: text('status'),
    detail: text('detail'),
    ip: text('ip'),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('events_user_at_idx').on(table.userId, table.at),
    index('events_device_idx').on(table.deviceId),
  ],
);

export const transfers = pgTable(
  'transfers',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fromDeviceId: text('from_device_id').references(() => devices.id, { onDelete: 'set null' }),
    toDeviceId: text('to_device_id').references(() => devices.id, { onDelete: 'set null' }),
    driveFileId: text('drive_file_id').notNull(),
    name: text('name').notNull(),
    bytes: integer('bytes'),
    status: transferStatus('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    ackedByDeviceId: text('acked_by_device_id').references(() => devices.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('transfers_user_created_idx').on(table.userId, table.createdAt),
    index('transfers_to_device_idx').on(table.toDeviceId, table.status),
  ],
);

export const devicesRelations = relations(devices, ({ many }) => ({
  tokens: many(deviceTokens),
}));

export const deviceTokensRelations = relations(deviceTokens, ({ one }) => ({
  device: one(devices, { fields: [deviceTokens.deviceId], references: [devices.id] }),
}));

export const schema = {
  users,
  googleConnections,
  webSessions,
  devices,
  deviceTokens,
  deviceAuthRequests,
  events,
  transfers,
  devicesRelations,
  deviceTokensRelations,
};

export type ConnectionStatus = (typeof connectionStatus.enumValues)[number];
export type DeviceTokenKind = (typeof deviceTokenKind.enumValues)[number];
export type DeviceAuthStatus = (typeof deviceAuthStatus.enumValues)[number];
export type TransferStatus = (typeof transferStatus.enumValues)[number];
export type EventType = (typeof eventType.enumValues)[number];

export type User = typeof users.$inferSelect;
export type Device = typeof devices.$inferSelect;
export type Transfer = typeof transfers.$inferSelect;
export type EventRow = typeof events.$inferSelect;
