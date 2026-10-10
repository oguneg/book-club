CREATE TABLE "reading_goal" (
	"user_id" text PRIMARY KEY NOT NULL,
	"yearly_books" integer,
	"daily_pages" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reading" ADD COLUMN "target_date" date;--> statement-breakpoint
ALTER TABLE "reading_goal" ADD CONSTRAINT "reading_goal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;