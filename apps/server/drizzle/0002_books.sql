CREATE TABLE "book_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cover" (
	"key" text PRIMARY KEY NOT NULL,
	"content_type" text,
	"bytes" "bytea",
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edition" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_id" text,
	"isbn13" text,
	"title" text NOT NULL,
	"subtitle" text,
	"authors" text[] DEFAULT '{}'::text[] NOT NULL,
	"publisher" text,
	"published" text,
	"page_count" integer,
	"language" text,
	"work_key" text,
	"cover" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "edition" ADD CONSTRAINT "edition_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "edition_source_uidx" ON "edition" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "edition_isbn13_idx" ON "edition" USING btree ("isbn13");--> statement-breakpoint
CREATE INDEX "edition_work_key_idx" ON "edition" USING btree ("work_key");