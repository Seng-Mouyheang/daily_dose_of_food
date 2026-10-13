CREATE TABLE "review_comment_likes" (
	"review_comment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_comment_likes_review_comment_id_user_id_pk" PRIMARY KEY("review_comment_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "review_comments" (
	"review_comment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_comment_id" uuid,
	"body" varchar(1000) NOT NULL,
	"media_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pinned_at" timestamp with time zone,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_review_comment_body" CHECK (char_length(btrim("review_comments"."body")) > 0 OR "review_comments"."media_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "review_likes" (
	"review_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_likes_review_id_user_id_pk" PRIMARY KEY("review_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "review_comment_likes" ADD CONSTRAINT "review_comment_likes_review_comment_id_review_comments_review_comment_id_fk" FOREIGN KEY ("review_comment_id") REFERENCES "public"."review_comments"("review_comment_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comment_likes" ADD CONSTRAINT "review_comment_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_parent_comment_id_review_comments_review_comment_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."review_comments"("review_comment_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_media_id_media_files_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_likes" ADD CONSTRAINT "review_likes_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_likes" ADD CONSTRAINT "review_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_review_comments_review" ON "review_comments" USING btree ("review_id","created_at" DESC) WHERE "review_comments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_review_comments_parent" ON "review_comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_review_comments_pinned" ON "review_comments" USING btree ("review_id") WHERE "review_comments"."pinned_at" IS NOT NULL AND "review_comments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_review_likes_user" ON "review_likes" USING btree ("user_id");