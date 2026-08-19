CREATE TABLE "project_versions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"client_updated_at" bigint NOT NULL,
	"saved_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"goal" text NOT NULL,
	"project_type" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"client_updated_at" bigint NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_owner_id_id_pk" PRIMARY KEY("owner_id","id")
);
--> statement-breakpoint
ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_owner_id_project_id_projects_owner_id_id_fk" FOREIGN KEY ("owner_id","project_id") REFERENCES "public"."projects"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_versions_owner_project_idx" ON "project_versions" USING btree ("owner_id","project_id");