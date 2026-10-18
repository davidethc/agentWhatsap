CREATE TABLE "media_purge_job" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_receipt" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"wa_message_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operational_grant" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbound_receipt" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"epoch" integer NOT NULL,
	"key" text NOT NULL,
	"message_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privacy_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"conversation_id" text,
	"actor_user_id" text,
	"action" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "control_epoch" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "content_deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "content_purge_pending" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "media_purge_job" ADD CONSTRAINT "media_purge_job_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_receipt" ADD CONSTRAINT "message_receipt_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_grant" ADD CONSTRAINT "operational_grant_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_grant" ADD CONSTRAINT "operational_grant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_receipt" ADD CONSTRAINT "outbound_receipt_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_audit" ADD CONSTRAINT "privacy_audit_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_purge_asset_uq" ON "media_purge_job" USING btree ("organization_id","asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_receipt_org_wa_uq" ON "message_receipt" USING btree ("organization_id","wa_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "operational_grant_org_user_uq" ON "operational_grant" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outbound_receipt_org_conv_key_uq" ON "outbound_receipt" USING btree ("organization_id","conversation_id","key");--> statement-breakpoint
CREATE INDEX "privacy_audit_org_date_idx" ON "privacy_audit" USING btree ("organization_id","created_at");