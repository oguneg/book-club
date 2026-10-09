CREATE TABLE "progress_event" (
	"id" text PRIMARY KEY NOT NULL,
	"reading_id" text NOT NULL,
	"position" integer NOT NULL,
	"page" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"edition_id" text NOT NULL,
	"book_key" text NOT NULL,
	"start_page" integer NOT NULL,
	"end_page" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"current_page" integer,
	"status" text DEFAULT 'reading' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "progress_event" ADD CONSTRAINT "progress_event_reading_id_reading_id_fk" FOREIGN KEY ("reading_id") REFERENCES "public"."reading"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading" ADD CONSTRAINT "reading_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading" ADD CONSTRAINT "reading_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "progress_event_reading_idx" ON "progress_event" USING btree ("reading_id","created_at");--> statement-breakpoint
CREATE INDEX "reading_user_idx" ON "reading" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reading_book_key_idx" ON "reading" USING btree ("book_key");--> statement-breakpoint
CREATE UNIQUE INDEX "reading_one_active_uidx" ON "reading" USING btree ("user_id","book_key") WHERE status = 'reading';