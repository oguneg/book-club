CREATE TABLE "club" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"invite_code" text NOT NULL,
	"member_cap" integer NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_book" (
	"id" text PRIMARY KEY NOT NULL,
	"club_id" text NOT NULL,
	"edition_id" text NOT NULL,
	"status" text NOT NULL,
	"start_date" date NOT NULL,
	"finish_date" date,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_member" (
	"club_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_member_club_id_user_id_pk" PRIMARY KEY("club_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "meeting" (
	"id" text PRIMARY KEY NOT NULL,
	"club_book_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"location" text,
	"read_to_page" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "club" ADD CONSTRAINT "club_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_book" ADD CONSTRAINT "club_book_club_id_club_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."club"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_book" ADD CONSTRAINT "club_book_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."edition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_member" ADD CONSTRAINT "club_member_club_id_club_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."club"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_member" ADD CONSTRAINT "club_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_club_book_id_club_book_id_fk" FOREIGN KEY ("club_book_id") REFERENCES "public"."club_book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "club_invite_code_uidx" ON "club" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "club_book_club_idx" ON "club_book" USING btree ("club_id");--> statement-breakpoint
CREATE UNIQUE INDEX "club_book_one_current_uidx" ON "club_book" USING btree ("club_id") WHERE status = 'current';--> statement-breakpoint
CREATE INDEX "club_member_user_idx" ON "club_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "club_member_one_owner_uidx" ON "club_member" USING btree ("club_id") WHERE role = 'owner';--> statement-breakpoint
CREATE INDEX "meeting_club_book_idx" ON "meeting" USING btree ("club_book_id");