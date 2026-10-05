import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	index,
	integer,
	numeric,
	pgTable,
	primaryKey,
	smallint,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar
} from 'drizzle-orm/pg-core';
import { cuisineTypes, drinkTypes, foodTypes } from './lookups.ts';
import { mediaFiles } from './media.ts';
import { places } from './places.ts';
import { users } from './users.ts';

export const reviews = pgTable(
	'reviews',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		placeId: uuid('place_id')
			.notNull()
			.references(() => places.id, { onDelete: 'restrict' }),
		reviewType: varchar('review_type', { length: 20 }).notNull(),
		visitType: varchar('visit_type', { length: 20 }).notNull(),
		/** null for drink-only reviews */
		mealType: varchar('meal_type', { length: 20 }),
		visitedAt: timestamp('visited_at', { withTimezone: true }).notNull(),
		overallRating: numeric('overall_rating', { precision: 2, scale: 1 }).notNull(),
		title: varchar('title', { length: 200 }),
		description: varchar('description', { length: 3000 }),
		visibility: varchar('visibility', { length: 20 }).notNull().default('public'),
		reviewStatus: varchar('review_status', { length: 20 }).notNull().default('draft'),
		isFavorite: boolean('is_favorite').notNull().default(false),
		isVerifiedVisit: boolean('is_verified_visit').notNull().default(false),
		editedAt: timestamp('edited_at', { withTimezone: true }),
		publishedAt: timestamp('published_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		deletedAt: timestamp('deleted_at', { withTimezone: true })
	},
	(t) => [
		index('idx_reviews_place_published')
			.on(t.placeId, sql`${t.publishedAt} DESC`)
			.where(sql`${t.reviewStatus} = 'published' AND ${t.deletedAt} IS NULL`),
		index('idx_reviews_user_published')
			.on(t.userId, sql`${t.publishedAt} DESC`)
			.where(sql`${t.reviewStatus} = 'published' AND ${t.deletedAt} IS NULL`),
		index('idx_reviews_visibility').on(t.visibility, sql`${t.publishedAt} DESC`),
		index('idx_reviews_visited_at').on(sql`${t.visitedAt} DESC`),
		check('chk_review_rating', sql`${t.overallRating} BETWEEN 1.0 AND 5.0`),
		check('chk_review_type', sql`${t.reviewType} IN ('food', 'drink', 'combined', 'general')`),
		check(
			'chk_visit_type',
			sql`${t.visitType} IN ('dine_in', 'takeaway', 'delivery', 'drive_through', 'other')`
		),
		check(
			'chk_meal_type',
			sql`${t.mealType} IS NULL OR ${t.mealType} IN ('breakfast', 'lunch', 'dinner', 'snack')`
		),
		check('chk_review_visibility', sql`${t.visibility} IN ('public', 'friends', 'private')`),
		check(
			'chk_review_status',
			sql`${t.reviewStatus} IN ('draft', 'published', 'hidden', 'removed', 'deleted')`
		)
	]
);

export const reviewMedia = pgTable(
	'review_media',
	{
		id: uuid('review_media_id').primaryKey().defaultRandom(),
		reviewId: uuid('review_id')
			.notNull()
			.references(() => reviews.id, { onDelete: 'cascade' }),
		mediaId: uuid('media_id')
			.notNull()
			.references(() => mediaFiles.id, { onDelete: 'restrict' }),
		mediaType: varchar('media_type', { length: 30 }).notNull().default('general'),
		caption: varchar('caption', { length: 500 }),
		displayOrder: integer('display_order').notNull().default(0),
		isCover: boolean('is_cover').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('uq_review_media').on(t.reviewId, t.mediaId),
		uniqueIndex('uq_review_cover_image')
			.on(t.reviewId)
			.where(sql`${t.isCover} = true`),
		check(
			'chk_review_media_type',
			sql`${t.mediaType} IN ('general', 'place', 'menu', 'receipt', 'atmosphere')`
		)
	]
);

export const reviewItems = pgTable(
	'review_items',
	{
		id: uuid('review_item_id').primaryKey().defaultRandom(),
		reviewId: uuid('review_id')
			.notNull()
			.references(() => reviews.id, { onDelete: 'cascade' }),
		itemType: varchar('item_type', { length: 20 }).notNull(),
		itemName: varchar('item_name', { length: 200 }).notNull(),
		description: text('description'),
		price: numeric('price', { precision: 12, scale: 2 }),
		/** Tax as a percentage, e.g. 8 for 8% */
		taxPercent: numeric('tax_percent', { precision: 5, scale: 2 }),
		currencyCode: varchar('currency_code', { length: 3 }),
		individualRating: numeric('individual_rating', { precision: 2, scale: 1 }),
		isFavorite: boolean('is_favorite').notNull().default(false),
		isLeastFavorite: boolean('is_least_favorite').notNull().default(false),
		displayOrder: integer('display_order').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date())
	},
	(t) => [
		index('idx_review_items_review').on(t.reviewId),
		check('chk_review_item_type', sql`${t.itemType} IN ('food', 'drink')`),
		check(
			'chk_review_item_rating',
			sql`${t.individualRating} IS NULL OR ${t.individualRating} BETWEEN 1.0 AND 5.0`
		),
		check('chk_review_item_tax', sql`${t.taxPercent} IS NULL OR ${t.taxPercent} >= 0`),
		check(
			'chk_review_item_preference',
			sql`NOT (${t.isFavorite} = true AND ${t.isLeastFavorite} = true)`
		)
	]
);

export const foodItemDetails = pgTable('food_item_details', {
	reviewItemId: uuid('review_item_id')
		.primaryKey()
		.references(() => reviewItems.id, { onDelete: 'cascade' }),
	cuisineTypeId: smallint('cuisine_type_id').references(() => cuisineTypes.id),
	portionSize: varchar('portion_size', { length: 20 }),
	/** Free text, e.g. "sweet, a little salty" */
	tasteNotes: varchar('taste_notes', { length: 200 })
});

export const reviewItemFoodTypes = pgTable(
	'review_item_food_types',
	{
		reviewItemId: uuid('review_item_id')
			.notNull()
			.references(() => reviewItems.id, { onDelete: 'cascade' }),
		foodTypeId: smallint('food_type_id')
			.notNull()
			.references(() => foodTypes.id)
	},
	(t) => [primaryKey({ columns: [t.reviewItemId, t.foodTypeId] })]
);

export const drinkItemDetails = pgTable(
	'drink_item_details',
	{
		reviewItemId: uuid('review_item_id')
			.primaryKey()
			.references(() => reviewItems.id, { onDelete: 'cascade' }),
		drinkTypeId: smallint('drink_type_id').references(() => drinkTypes.id),
		sizeLabel: varchar('size_label', { length: 30 }),
		sugarLevelPercent: smallint('sugar_level_percent'),
		iceLevel: varchar('ice_level', { length: 30 })
	},
	(t) => [
		check(
			'chk_drink_sugar',
			sql`${t.sugarLevelPercent} IS NULL OR ${t.sugarLevelPercent} BETWEEN 0 AND 200`
		)
	]
);
