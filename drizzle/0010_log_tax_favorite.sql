ALTER TABLE "logs" ADD COLUMN "tax_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "logs" ADD COLUMN "is_favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "chk_log_tax" CHECK ("logs"."tax_percent" IS NULL OR "logs"."tax_percent" >= 0);