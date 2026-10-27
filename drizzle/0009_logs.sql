CREATE TABLE "logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"logged_on" date NOT NULL,
	"place_id" uuid,
	"place_name" varchar(200),
	"title" varchar(200) NOT NULL,
	"item_type" varchar(20) NOT NULL,
	"food_type_id" smallint,
	"drink_type_id" smallint,
	"cuisine_type_id" smallint,
	"qty" integer DEFAULT 1 NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"meal_type" varchar(20) NOT NULL,
	"visit_type" varchar(20) NOT NULL,
	"overall_rating" smallint NOT NULL,
	"note" varchar(200),
	"review_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_log_place" CHECK ("logs"."place_id" IS NOT NULL OR "logs"."place_name" IS NOT NULL),
	CONSTRAINT "chk_log_item_type" CHECK ("logs"."item_type" IN ('food', 'drink')),
	CONSTRAINT "chk_log_qty" CHECK ("logs"."qty" >= 1),
	CONSTRAINT "chk_log_price" CHECK ("logs"."price" >= 0),
	CONSTRAINT "chk_log_rating" CHECK ("logs"."overall_rating" BETWEEN 1 AND 5),
	CONSTRAINT "chk_log_meal_type" CHECK ("logs"."meal_type" IN ('breakfast', 'lunch', 'dinner', 'snack')),
	CONSTRAINT "chk_log_visit_type" CHECK ("logs"."visit_type" IN ('dine_in', 'takeaway', 'delivery'))
);
--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_food_type_id_food_types_food_type_id_fk" FOREIGN KEY ("food_type_id") REFERENCES "public"."food_types"("food_type_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_drink_type_id_drink_types_drink_type_id_fk" FOREIGN KEY ("drink_type_id") REFERENCES "public"."drink_types"("drink_type_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_cuisine_type_id_cuisine_types_cuisine_type_id_fk" FOREIGN KEY ("cuisine_type_id") REFERENCES "public"."cuisine_types"("cuisine_type_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_logs_user_day" ON "logs" USING btree ("user_id","logged_on" DESC);--> statement-breakpoint
CREATE INDEX "idx_logs_review" ON "logs" USING btree ("review_id") WHERE "logs"."review_id" IS NOT NULL;