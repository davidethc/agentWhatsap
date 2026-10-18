ALTER TABLE "outbound_receipt" ALTER COLUMN "message_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "outbound_receipt" ADD COLUMN "request_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "outbound_receipt" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;