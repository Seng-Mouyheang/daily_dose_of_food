CREATE TABLE "review_saves" (
	"review_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_saves_review_id_user_id_pk" PRIMARY KEY("review_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "review_saves" ADD CONSTRAINT "review_saves_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_saves" ADD CONSTRAINT "review_saves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_review_saves_user" ON "review_saves" USING btree ("user_id","created_at" DESC);