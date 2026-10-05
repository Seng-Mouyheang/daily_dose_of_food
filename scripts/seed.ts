import './network.ts';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../src/lib/server/db/schema/index.ts';
import {
	cuisineSeed,
	drinkTypeSeed,
	foodTypeSeed,
	placeCategorySeed,
	ratingCategorySeed,
	slugify
} from './seed-data.ts';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const db = drizzle(neon(url), { schema });

await db.insert(schema.placeCategories).values(placeCategorySeed).onConflictDoNothing();
await db.insert(schema.cuisineTypes).values(cuisineSeed).onConflictDoNothing();
await db.insert(schema.foodTypes).values(foodTypeSeed).onConflictDoNothing();
await db.insert(schema.drinkTypes).values(drinkTypeSeed).onConflictDoNothing();

await db
	.insert(schema.ratingCategories)
	.values(
		ratingCategorySeed.map((c, displayOrder) => ({
			name: c.name,
			slug: slugify(c.name),
			appliesToFood: c.appliesToFood,
			appliesToDrink: c.appliesToDrink,
			appliesToPlace: c.appliesToPlace,
			appliesToDineIn: c.appliesToDineIn,
			appliesToTakeaway: c.appliesToTakeaway,
			appliesToDelivery: c.appliesToDelivery,
			displayOrder
		}))
	)
	.onConflictDoNothing();

const categories = await db.select().from(schema.ratingCategories);
const idBySlug = new Map(categories.map((c) => [c.slug, c.id]));

const options = ratingCategorySeed.flatMap((c) => {
	const ratingCategoryId = idBySlug.get(slugify(c.name));
	if (ratingCategoryId == null) throw new Error(`Missing rating category: ${c.name}`);
	return [
		...c.positive.map((label) => ({ label, sentiment: 'positive' })),
		...c.negative.map((label) => ({ label, sentiment: 'negative' }))
	].map((o, displayOrder) => ({ ...o, ratingCategoryId, displayOrder }));
});
await db.insert(schema.ratingCriteriaOptions).values(options).onConflictDoNothing();

console.log(
	`Seeded ${placeCategorySeed.length} place categories, ${cuisineSeed.length} cuisines, ` +
		`${foodTypeSeed.length} food types, ${drinkTypeSeed.length} drink types, ` +
		`${ratingCategorySeed.length} rating categories, ${options.length} criteria options.`
);
