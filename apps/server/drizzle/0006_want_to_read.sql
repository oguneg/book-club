CREATE TABLE "want_to_read" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"edition_id" text NOT NULL,
	"book_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "want_to_read" ADD CONSTRAINT "want_to_read_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "want_to_read" ADD CONSTRAINT "want_to_read_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "want_to_read_user_book_uidx" ON "want_to_read" USING btree ("user_id","book_key");