CREATE TYPE "public"."connection_status" AS ENUM('active', 'revoked', 'error');--> statement-breakpoint
CREATE TYPE "public"."device_auth_status" AS ENUM('pending', 'approved', 'denied', 'expired');--> statement-breakpoint
CREATE TYPE "public"."device_token_kind" AS ENUM('refresh', 'access');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('upload', 'download', 'mkdir', 'mv', 'rm', 'share', 'send', 'receive', 'login', 'device_approved', 'device_revoked', 'drive_token_issued', 'device_token_reuse', 'google_connected', 'google_disconnected', 'account_deleted');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('pending', 'delivered', 'expired');--> statement-breakpoint
CREATE TABLE "device_auth_requests" (
	"device_code_hash" text PRIMARY KEY NOT NULL,
	"user_code" text NOT NULL,
	"hostname" text,
	"os" text,
	"cli_version" text,
	"request_ip" text,
	"status" "device_auth_status" DEFAULT 'pending' NOT NULL,
	"user_id" text,
	"device_id" text,
	"device_name" text,
	"last_polled_at" timestamp with time zone,
	"poll_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"kind" "device_token_kind" NOT NULL,
	"token_hash" text NOT NULL,
	"family_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"hostname" text,
	"os" text,
	"cli_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_ip" text,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"device_id" text,
	"type" "event_type" NOT NULL,
	"path" text,
	"drive_file_id" text,
	"bytes" integer,
	"status" text,
	"detail" text,
	"ip" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_connections" (
	"user_id" text PRIMARY KEY NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"scopes" text[] NOT NULL,
	"status" "connection_status" DEFAULT 'active' NOT NULL,
	"access_token_enc" text,
	"access_token_expires_at" timestamp with time zone,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_refreshed_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"from_device_id" text,
	"to_device_id" text,
	"drive_file_id" text NOT NULL,
	"name" text NOT NULL,
	"bytes" integer,
	"status" "transfer_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"acked_by_device_id" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"google_sub" text NOT NULL,
	"email" text NOT NULL,
	"drive_root_folder_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "web_sessions" (
	"id_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
ALTER TABLE "device_auth_requests" ADD CONSTRAINT "device_auth_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_auth_requests" ADD CONSTRAINT "device_auth_requests_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_connections" ADD CONSTRAINT "google_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_device_id_devices_id_fk" FOREIGN KEY ("from_device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_device_id_devices_id_fk" FOREIGN KEY ("to_device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_acked_by_device_id_devices_id_fk" FOREIGN KEY ("acked_by_device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_sessions" ADD CONSTRAINT "web_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "device_auth_user_code_idx" ON "device_auth_requests" USING btree ("user_code");--> statement-breakpoint
CREATE UNIQUE INDEX "device_tokens_hash_idx" ON "device_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "device_tokens_device_idx" ON "device_tokens" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "device_tokens_family_idx" ON "device_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "devices_user_idx" ON "devices" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_user_name_idx" ON "devices" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "events_user_at_idx" ON "events" USING btree ("user_id","at");--> statement-breakpoint
CREATE INDEX "events_device_idx" ON "events" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "transfers_user_created_idx" ON "transfers" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "transfers_to_device_idx" ON "transfers" USING btree ("to_device_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_google_sub_idx" ON "users" USING btree ("google_sub");--> statement-breakpoint
CREATE INDEX "web_sessions_user_idx" ON "web_sessions" USING btree ("user_id");