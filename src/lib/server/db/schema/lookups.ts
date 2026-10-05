import { boolean, pgTable, smallserial, varchar } from 'drizzle-orm/pg-core';

export const foodTypes = pgTable('food_types', {
	id: smallserial('food_type_id').primaryKey(),
	name: varchar('name', { length: 100 }).notNull().unique(),
	slug: varchar('slug', { length: 100 }).notNull().unique(),
	isActive: boolean('is_active').notNull().default(true)
});

export const cuisineTypes = pgTable('cuisine_types', {
	id: smallserial('cuisine_type_id').primaryKey(),
	name: varchar('name', { length: 100 }).notNull().unique(),
	slug: varchar('slug', { length: 100 }).notNull().unique(),
	isActive: boolean('is_active').notNull().default(true)
});

export const drinkTypes = pgTable('drink_types', {
	id: smallserial('drink_type_id').primaryKey(),
	name: varchar('name', { length: 100 }).notNull().unique(),
	slug: varchar('slug', { length: 100 }).notNull().unique(),
	isAgeRestricted: boolean('is_age_restricted').notNull().default(false),
	isActive: boolean('is_active').notNull().default(true)
});
