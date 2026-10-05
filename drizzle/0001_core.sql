CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"username" "citext" NOT NULL,
	"email" "citext" NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"bio" varchar(1000),
	"avatar_media_id" uuid,
	"account_status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "chk_user_account_status" CHECK ("users"."account_status" IN ('pending', 'active', 'suspended', 'deactivated', 'deleted'))
);
--> statement-breakpoint
CREATE TABLE "media_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"storage_provider" varchar(30) DEFAULT 'cloudinary' NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"original_filename" varchar(255),
	"format" varchar(20),
	"width" integer,
	"height" integer,
	"bytes" integer,
	"media_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"moderation_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "media_files_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "chk_media_status" CHECK ("media_files"."media_status" IN ('pending', 'active', 'failed', 'deleted')),
	CONSTRAINT "chk_media_moderation" CHECK ("media_files"."moderation_status" IN ('pending', 'approved', 'rejected', 'flagged'))
);
--> statement-breakpoint
CREATE TABLE "place_categories" (
	"place_category_id" "smallserial" PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "place_categories_name_unique" UNIQUE("name"),
	CONSTRAINT "place_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_category_id" smallint,
	"name" varchar(200) NOT NULL,
	"slug" varchar(250),
	"description" text,
	"phone_number" varchar(50),
	"website_url" text,
	"price_level" smallint,
	"location" geography(Point, 4326) NOT NULL,
	"address_line_1" varchar(255),
	"address_line_2" varchar(255),
	"district" varchar(100),
	"city" varchar(100),
	"province" varchar(100),
	"country_code" varchar(2) NOT NULL,
	"postal_code" varchar(20),
	"verification_status" varchar(20) DEFAULT 'unverified' NOT NULL,
	"place_status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid,
	"merged_into_place_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_place_price_level" CHECK ("places"."price_level" IS NULL OR "places"."price_level" BETWEEN 1 AND 4),
	CONSTRAINT "chk_place_status" CHECK ("places"."place_status" IN ('active', 'temporarily_closed', 'closed', 'merged', 'deleted')),
	CONSTRAINT "chk_place_verification" CHECK ("places"."verification_status" IN ('unverified', 'verified', 'claimed'))
);
--> statement-breakpoint
CREATE TABLE "cuisine_types" (
	"cuisine_type_id" "smallserial" PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "cuisine_types_name_unique" UNIQUE("name"),
	CONSTRAINT "cuisine_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "drink_types" (
	"drink_type_id" "smallserial" PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"is_age_restricted" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "drink_types_name_unique" UNIQUE("name"),
	CONSTRAINT "drink_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "food_types" (
	"food_type_id" "smallserial" PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "food_types_name_unique" UNIQUE("name"),
	CONSTRAINT "food_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "drink_item_details" (
	"review_item_id" uuid PRIMARY KEY NOT NULL,
	"drink_type_id" smallint,
	"size_label" varchar(30),
	"sugar_level_percent" smallint,
	"ice_level" varchar(30),
	CONSTRAINT "chk_drink_sugar" CHECK ("drink_item_details"."sugar_level_percent" IS NULL OR "drink_item_details"."sugar_level_percent" BETWEEN 0 AND 200)
);
--> statement-breakpoint
CREATE TABLE "food_item_details" (
	"review_item_id" uuid PRIMARY KEY NOT NULL,
	"cuisine_type_id" smallint,
	"portion_size" varchar(20),
	"taste_notes" varchar(200)
);
--> statement-breakpoint
CREATE TABLE "review_item_food_types" (
	"review_item_id" uuid NOT NULL,
	"food_type_id" smallint NOT NULL,
	CONSTRAINT "review_item_food_types_review_item_id_food_type_id_pk" PRIMARY KEY("review_item_id","food_type_id")
);
--> statement-breakpoint
CREATE TABLE "review_items" (
	"review_item_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"item_type" varchar(20) NOT NULL,
	"item_name" varchar(200) NOT NULL,
	"description" text,
	"price" numeric(12, 2),
	"tax_percent" numeric(5, 2),
	"currency_code" varchar(3),
	"individual_rating" numeric(2, 1),
	"is_favorite" boolean DEFAULT false NOT NULL,
	"is_least_favorite" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_review_item_type" CHECK ("review_items"."item_type" IN ('food', 'drink')),
	CONSTRAINT "chk_review_item_rating" CHECK ("review_items"."individual_rating" IS NULL OR "review_items"."individual_rating" BETWEEN 1.0 AND 5.0),
	CONSTRAINT "chk_review_item_tax" CHECK ("review_items"."tax_percent" IS NULL OR "review_items"."tax_percent" >= 0),
	CONSTRAINT "chk_review_item_preference" CHECK (NOT ("review_items"."is_favorite" = true AND "review_items"."is_least_favorite" = true))
);
--> statement-breakpoint
CREATE TABLE "review_media" (
	"review_media_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"media_type" varchar(30) DEFAULT 'general' NOT NULL,
	"caption" varchar(500),
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_review_media_type" CHECK ("review_media"."media_type" IN ('general', 'place', 'menu', 'receipt', 'atmosphere'))
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"review_type" varchar(20) NOT NULL,
	"visit_type" varchar(20) NOT NULL,
	"meal_type" varchar(20),
	"visited_at" timestamp with time zone NOT NULL,
	"overall_rating" numeric(2, 1) NOT NULL,
	"title" varchar(200),
	"description" varchar(3000),
	"visibility" varchar(20) DEFAULT 'public' NOT NULL,
	"review_status" varchar(20) DEFAULT 'draft' NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"is_verified_visit" boolean DEFAULT false NOT NULL,
	"edited_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_review_rating" CHECK ("reviews"."overall_rating" BETWEEN 1.0 AND 5.0),
	CONSTRAINT "chk_review_type" CHECK ("reviews"."review_type" IN ('food', 'drink', 'combined', 'general')),
	CONSTRAINT "chk_visit_type" CHECK ("reviews"."visit_type" IN ('dine_in', 'takeaway', 'delivery', 'drive_through', 'other')),
	CONSTRAINT "chk_meal_type" CHECK ("reviews"."meal_type" IS NULL OR "reviews"."meal_type" IN ('breakfast', 'lunch', 'dinner', 'snack')),
	CONSTRAINT "chk_review_visibility" CHECK ("reviews"."visibility" IN ('public', 'friends', 'private')),
	CONSTRAINT "chk_review_status" CHECK ("reviews"."review_status" IN ('draft', 'published', 'hidden', 'removed', 'deleted'))
);
--> statement-breakpoint
CREATE TABLE "rating_categories" (
	"rating_category_id" "smallserial" PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"applies_to_food" boolean DEFAULT false NOT NULL,
	"applies_to_drink" boolean DEFAULT false NOT NULL,
	"applies_to_place" boolean DEFAULT true NOT NULL,
	"applies_to_dine_in" boolean DEFAULT true NOT NULL,
	"applies_to_takeaway" boolean DEFAULT true NOT NULL,
	"applies_to_delivery" boolean DEFAULT true NOT NULL,
	"rating_required" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "rating_categories_name_unique" UNIQUE("name"),
	CONSTRAINT "rating_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rating_criteria_options" (
	"criteria_option_id" "smallserial" PRIMARY KEY NOT NULL,
	"rating_category_id" smallint NOT NULL,
	"label" varchar(150) NOT NULL,
	"sentiment" varchar(20) NOT NULL,
	"score_weight" numeric(4, 2),
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "uq_category_criteria" UNIQUE("rating_category_id","label"),
	CONSTRAINT "chk_criteria_sentiment" CHECK ("rating_criteria_options"."sentiment" IN ('positive', 'neutral', 'negative'))
);
--> statement-breakpoint
CREATE TABLE "review_category_ratings" (
	"review_category_rating_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"review_item_id" uuid,
	"rating_category_id" smallint NOT NULL,
	"rating_value" numeric(2, 1),
	"is_applicable" boolean DEFAULT true NOT NULL,
	"comment" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_category_rating" CHECK ("review_category_ratings"."rating_value" IS NULL OR "review_category_ratings"."rating_value" BETWEEN 1.0 AND 5.0)
);
--> statement-breakpoint
CREATE TABLE "review_rating_criteria" (
	"review_category_rating_id" uuid NOT NULL,
	"criteria_option_id" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_rating_criteria_review_category_rating_id_criteria_option_id_pk" PRIMARY KEY("review_category_rating_id","criteria_option_id")
);
--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_place_category_id_place_categories_place_category_id_fk" FOREIGN KEY ("place_category_id") REFERENCES "public"."place_categories"("place_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drink_item_details" ADD CONSTRAINT "drink_item_details_review_item_id_review_items_review_item_id_fk" FOREIGN KEY ("review_item_id") REFERENCES "public"."review_items"("review_item_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drink_item_details" ADD CONSTRAINT "drink_item_details_drink_type_id_drink_types_drink_type_id_fk" FOREIGN KEY ("drink_type_id") REFERENCES "public"."drink_types"("drink_type_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_item_details" ADD CONSTRAINT "food_item_details_review_item_id_review_items_review_item_id_fk" FOREIGN KEY ("review_item_id") REFERENCES "public"."review_items"("review_item_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_item_details" ADD CONSTRAINT "food_item_details_cuisine_type_id_cuisine_types_cuisine_type_id_fk" FOREIGN KEY ("cuisine_type_id") REFERENCES "public"."cuisine_types"("cuisine_type_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_item_food_types" ADD CONSTRAINT "review_item_food_types_review_item_id_review_items_review_item_id_fk" FOREIGN KEY ("review_item_id") REFERENCES "public"."review_items"("review_item_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_item_food_types" ADD CONSTRAINT "review_item_food_types_food_type_id_food_types_food_type_id_fk" FOREIGN KEY ("food_type_id") REFERENCES "public"."food_types"("food_type_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_media" ADD CONSTRAINT "review_media_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_media" ADD CONSTRAINT "review_media_media_id_media_files_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_criteria_options" ADD CONSTRAINT "rating_criteria_options_rating_category_id_rating_categories_rating_category_id_fk" FOREIGN KEY ("rating_category_id") REFERENCES "public"."rating_categories"("rating_category_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_category_ratings" ADD CONSTRAINT "review_category_ratings_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_category_ratings" ADD CONSTRAINT "review_category_ratings_review_item_id_review_items_review_item_id_fk" FOREIGN KEY ("review_item_id") REFERENCES "public"."review_items"("review_item_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_category_ratings" ADD CONSTRAINT "review_category_ratings_rating_category_id_rating_categories_rating_category_id_fk" FOREIGN KEY ("rating_category_id") REFERENCES "public"."rating_categories"("rating_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_rating_criteria" ADD CONSTRAINT "review_rating_criteria_review_category_rating_id_review_category_ratings_review_category_rating_id_fk" FOREIGN KEY ("review_category_rating_id") REFERENCES "public"."review_category_ratings"("review_category_rating_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_rating_criteria" ADD CONSTRAINT "review_rating_criteria_criteria_option_id_rating_criteria_options_criteria_option_id_fk" FOREIGN KEY ("criteria_option_id") REFERENCES "public"."rating_criteria_options"("criteria_option_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_username_active" ON "users" USING btree ("username") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email_active" ON "users" USING btree ("email") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_places_location" ON "places" USING gist ("location");--> statement-breakpoint
CREATE INDEX "idx_review_items_review" ON "review_items" USING btree ("review_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_review_media" ON "review_media" USING btree ("review_id","media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_review_cover_image" ON "review_media" USING btree ("review_id") WHERE "review_media"."is_cover" = true;--> statement-breakpoint
CREATE INDEX "idx_reviews_place_published" ON "reviews" USING btree ("place_id","published_at" DESC) WHERE "reviews"."review_status" = 'published' AND "reviews"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_reviews_user_published" ON "reviews" USING btree ("user_id","published_at" DESC) WHERE "reviews"."review_status" = 'published' AND "reviews"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_reviews_visibility" ON "reviews" USING btree ("visibility","published_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_reviews_visited_at" ON "reviews" USING btree ("visited_at" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_review_place_category_rating" ON "review_category_ratings" USING btree ("review_id","rating_category_id") WHERE "review_category_ratings"."review_item_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_review_item_category_rating" ON "review_category_ratings" USING btree ("review_id","review_item_id","rating_category_id") WHERE "review_category_ratings"."review_item_id" IS NOT NULL;