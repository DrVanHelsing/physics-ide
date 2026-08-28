CREATE TABLE "shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"sharer_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"source_owner_id" uuid NOT NULL,
	"source_project_id" text NOT NULL,
	"frozen_manifest" jsonb NOT NULL,
	"source_client_updated_at" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"copy_project_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "peer_sharing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "attribution" jsonb;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shares_recipient_status_idx" ON "shares" USING btree ("recipient_id","status");--> statement-breakpoint
CREATE INDEX "shares_class_status_idx" ON "shares" USING btree ("class_id","status");