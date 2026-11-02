import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	date,
	index,
	integer,
	numeric,
	pgTable,
	smallint,
	timestamp,
	uuid,
	varchar
} from 'drizzle-orm/pg-core';
import { cuisineTypes, drinkTypes, foodTypes } from './lookups.ts';
import { places } from './places.ts';
import { reviews } from './reviews.ts';
import { users } from './users.ts';

/** One item from the private food diary. A "visit" is not stored: it is the logs that share
 *  a date, meal, place and dining option, grouped when read. */
export const logs = pgTable(
	'logs',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		/** The user's local calendar day, never in the future */
		loggedOn: date('logged_on', { mode: 'string' }).notNull(),
		/** Set for a known place; a place typed in the log form has no coordinates, so it is
		 *  kept as `placeName` text until the visit is turned into a review. */
		placeId: uuid('place_id').references(() => places.id, { onDelete: 'restrict' }),
		placeName: varchar('place_name', { length: 200 }),
		title: varchar('title', { length: 200 }).notNull(),
		itemType: varchar('item_type', { length: 20 }).notNull(),
		foodTypeId: smallint('food_type_id').references(() => foodTypes.id),
		drinkTypeId: smallint('drink_type_id').references(() => drinkTypes.id),
		cuisineTypeId: smallint('cuisine_type_id').references(() => cuisineTypes.id),
		qty: integer('qty').notNull().default(1),
		/** Line total paid, tax included: price each × qty × (1 + tax ÷ 100) */
		price: numeric('price', { precision: 12, scale: 2 }).notNull(),
		/** Tax as a percentage, e.g. 10 for 10%; kept so the price can be split again later */
		taxPercent: numeric('tax_percent', { precision: 5, scale: 2 }),
		/** A dish or drink you loved */
		isFavorite: boolean('is_favorite').notNull().default(false),
		mealType: varchar('meal_type', { length: 20 }).notNull(),
		visitType: varchar('visit_type', { length: 20 }).notNull(),
		overallRating: smallint('overall_rating').notNull(),
		/** Shared by every log in the visit */
		note: varchar('note', { length: 200 }),
		/** Set once the visit is published as a review, so the dashboard doesn't count it twice */
		reviewId: uuid('review_id').references(() => reviews.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('idx_logs_user_day').on(t.userId, sql`${t.loggedOn} DESC`),
		index('idx_logs_review')
			.on(t.reviewId)
			.where(sql`${t.reviewId} IS NOT NULL`),
		check('chk_log_place', sql`${t.placeId} IS NOT NULL OR ${t.placeName} IS NOT NULL`),
		check('chk_log_item_type', sql`${t.itemType} IN ('food', 'drink')`),
		check('chk_log_qty', sql`${t.qty} >= 1`),
		check('chk_log_price', sql`${t.price} >= 0`),
		check('chk_log_tax', sql`${t.taxPercent} IS NULL OR ${t.taxPercent} >= 0`),
		check('chk_log_rating', sql`${t.overallRating} BETWEEN 1 AND 5`),
		check('chk_log_meal_type', sql`${t.mealType} IN ('breakfast', 'lunch', 'dinner', 'snack')`),
		check('chk_log_visit_type', sql`${t.visitType} IN ('dine_in', 'takeaway', 'delivery')`)
	]
);
