ALTER TABLE "emails" ADD COLUMN "provider_id" text;--> statement-breakpoint
CREATE INDEX "emails_provider_id_idx" ON "emails" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "emails_created_at_idx" ON "emails" USING btree ("created_at");