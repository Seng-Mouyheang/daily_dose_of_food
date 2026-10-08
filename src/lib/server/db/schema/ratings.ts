import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	integer,
	numeric,
	pgTable,
	primaryKey,
	smallint,
	smallserial,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
	varchar
} from 'drizzle-orm/pg-core';
import { reviewItems, reviews } from './reviews.ts';

export const ratingCategories = pgTable('rating_categories', {
	id: smallserial('rating_category_id').primaryKey(),
	name: varchar('name', { length: 100 }).notNull().unique(),
	slug: varchar('slug', { length: 100 }).notNull().unique(),
	appliesToFood: boolean('applies_to_food').notNull().default(false),
	appliesToDrink: boolean('applies_to_drink').notNull().default(false),
	appliesToPlace: boolean('applies_to_place').notNull().default(true),
	appliesToDineIn: boolean('applies_to_dine_in').notNull().default(true),
	appliesToTakeaway: boolean('applies_to_takeaway').notNull().default(true),
	appliesToDelivery: boolean('applies_to_delivery').notNull().default(true),
	ratingRequired: boolean('rating_required').notNull().default(false),
	displayOrder: integer('display_order').notNull().default(0),
	isActive: boolean('is_active').notNull().default(true)
});

export const ratingCriteriaOptions = pgTable(
	'rating_criteria_options',
	{
		id: smallserial('criteria_option_id').primaryKey(),
		ratingCategoryId: smallint('rating_category_id')
			.notNull()
			.references(() => ratingCategories.id, { onDelete: 'restrict' }),
		label: varchar('label', { length: 150 }).notNull(),
		sentiment: varchar('sentiment', { length: 20 }).notNull(),
		scoreWeight: numeric('score_weight', { precision: 4, scale: 2 }),
		displayOrder: integer('display_order').notNull().default(0),
		isActive: boolean('is_active').notNull().default(true)
	},
	(t) => [
		unique('uq_category_criteria').on(t.ratingCategoryId, t.label, t.sentiment),
		check('chk_criteria_sentiment', sql`${t.sentiment} IN ('positive', 'neutral', 'negative')`)
	]
);

export const reviewCategoryRatings = pgTable(
	'review_category_ratings',
	{
		id: uuid('review_category_rating_id').primaryKey().defaultRandom(),
		reviewId: uuid('review_id')
			.notNull()
			.references(() => reviews.id, { onDelete: 'cascade' }),
		/** null = rating applies to the whole visit/place */
		reviewItemId: uuid('review_item_id').references(() => reviewItems.id, {
			onDelete: 'cascade'
		}),
		ratingCategoryId: smallint('rating_category_id')
			.notNull()
			.references(() => ratingCategories.id),
		ratingValue: numeric('rating_value', { precision: 2, scale: 1 }),
		isApplicable: boolean('is_applicable').notNull().default(true),
		comment: varchar('comment', { length: 500 }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date())
	},
	(t) => [
		uniqueIndex('uq_review_place_category_rating')
			.on(t.reviewId, t.ratingCategoryId)
			.where(sql`${t.reviewItemId} IS NULL`),
		uniqueIndex('uq_review_item_category_rating')
			.on(t.reviewId, t.reviewItemId, t.ratingCategoryId)
			.where(sql`${t.reviewItemId} IS NOT NULL`),
		check(
			'chk_category_rating',
			sql`${t.ratingValue} IS NULL OR ${t.ratingValue} BETWEEN 1.0 AND 5.0`
		)
	]
);

export const reviewRatingCriteria = pgTable(
	'review_rating_criteria',
	{
		reviewCategoryRatingId: uuid('review_category_rating_id')
			.notNull()
			.references(() => reviewCategoryRatings.id, { onDelete: 'cascade' }),
		criteriaOptionId: smallint('criteria_option_id')
			.notNull()
			.references(() => ratingCriteriaOptions.id),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [primaryKey({ columns: [t.reviewCategoryRatingId, t.criteriaOptionId] })]
);
