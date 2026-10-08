import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	index,
	pgTable,
	smallint,
	smallserial,
	text,
	timestamp,
	uuid,
	varchar
} from 'drizzle-orm/pg-core';
import { geographyPoint } from './types.ts';
import { users } from './users.ts';

export const placeCategories = pgTable('place_categories', {
	id: smallserial('place_category_id').primaryKey(),
	name: varchar('name', { length: 100 }).notNull().unique(),
	slug: varchar('slug', { length: 100 }).notNull().unique(),
	description: text('description'),
	isActive: boolean('is_active').notNull().default(true),
	displayOrder: smallint('display_order').notNull().default(0)
});

export const places = pgTable(
	'places',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		placeCategoryId: smallint('place_category_id').references(() => placeCategories.id),
		name: varchar('name', { length: 200 }).notNull(),
		/** Only curated/seeded places get one (see scripts/seed.ts) — a user-created place
		 *  (reviews.ts) leaves this null, and a plain unique index allows any number of NULLs,
		 *  so this only ever constrains the seeded rows against each other. */
		slug: varchar('slug', { length: 250 }).unique(),
		description: text('description'),
		phoneNumber: varchar('phone_number', { length: 50 }),
		websiteUrl: text('website_url'),
		priceLevel: smallint('price_level'),
		location: geographyPoint('location').notNull(),
		addressLine1: varchar('address_line_1', { length: 255 }),
		addressLine2: varchar('address_line_2', { length: 255 }),
		district: varchar('district', { length: 100 }),
		city: varchar('city', { length: 100 }),
		province: varchar('province', { length: 100 }),
		countryCode: varchar('country_code', { length: 2 }).notNull(),
		postalCode: varchar('postal_code', { length: 20 }),
		verificationStatus: varchar('verification_status', { length: 20 })
			.notNull()
			.default('unverified'),
		placeStatus: varchar('place_status', { length: 20 }).notNull().default('active'),
		createdByUserId: uuid('created_by_user_id').references(() => users.id),
		mergedIntoPlaceId: uuid('merged_into_place_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		deletedAt: timestamp('deleted_at', { withTimezone: true })
	},
	(t) => [
		index('idx_places_location').using('gist', t.location),
		check('chk_place_price_level', sql`${t.priceLevel} IS NULL OR ${t.priceLevel} BETWEEN 1 AND 4`),
		check(
			'chk_place_status',
			sql`${t.placeStatus} IN ('active', 'temporarily_closed', 'closed', 'merged', 'deleted')`
		),
		check(
			'chk_place_verification',
			sql`${t.verificationStatus} IN ('unverified', 'verified', 'claimed')`
		)
	]
);
