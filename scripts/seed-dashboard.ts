/**
 * Opt-in demo data for the dashboard: about a year of *private* reviews in one account, so the
 * Year view and period comparisons have something to show.
 *
 *   pnpm db:seed-dashboard you@example.com           add them (run `pnpm db:seed` first)
 *   pnpm db:seed-dashboard you@example.com --remove  delete exactly those reviews again
 *
 * Every seeded review carries DASHBOARD_SEED_NOTE as its description; that's how --remove finds
 * them, and children (items, ratings) go with them via ON DELETE CASCADE.
 */
import './network.ts';
import { neon } from '@neondatabase/serverless';
import { and, count, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../src/lib/server/db/schema/index.ts';
import { DASHBOARD_SEED_NOTE, dashboardSeed } from './seed-data.ts';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const [email, flag] = process.argv.slice(2);
if (!email) throw new Error('Usage: pnpm db:seed-dashboard <email> [--remove]');

const db = drizzle(neon(url), { schema });
const {
	users,
	reviews,
	reviewItems,
	foodItemDetails,
	reviewItemFoodTypes,
	drinkItemDetails,
	reviewCategoryRatings
} = schema;

const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
if (!user) throw new Error(`No user with email ${email}. Sign in to the app once first.`);
const mine = and(eq(reviews.userId, user.id), eq(reviews.description, DASHBOARD_SEED_NOTE));

if (flag === '--remove') {
	const gone = await db.delete(reviews).where(mine).returning({ id: reviews.id });
	console.log(`Removed ${gone.length} seeded reviews.`);
	process.exit(0);
}

const [{ n }] = (await db.select({ n: count() }).from(reviews).where(mine)) as [{ n: number }];
if (n > 0) throw new Error(`${n} seeded reviews already exist. Run with --remove first to reseed.`);

const byKey = <K extends string, V>(rows: Record<K | 'id', unknown>[], key: K) =>
	new Map(rows.map((r) => [String(r[key]), r.id as V]));
const placeId = byKey<'slug', string>(
	await db.select({ id: schema.places.id, slug: schema.places.slug }).from(schema.places),
	'slug'
);
const cuisineId = byKey<'name', number>(await db.select().from(schema.cuisineTypes), 'name');
const foodTypeId = byKey<'name', number>(await db.select().from(schema.foodTypes), 'name');
const drinkTypeId = byKey<'name', number>(await db.select().from(schema.drinkTypes), 'name');
const categoryId = byKey<'slug', number>(await db.select().from(schema.ratingCategories), 'slug');
if (!placeId.size || !categoryId.size)
	throw new Error('Lookups or places missing. Run `pnpm db:seed` first.');
/** The id for `key`, or stop before inserting anything if the lookup row doesn't exist. */
const need = <V>(map: Map<string, V>, key: string, what: string): V => {
	const id = map.get(key);
	if (id === undefined)
		throw new Error(`No ${what} "${key}" in the database. Run \`pnpm db:seed\` first.`);
	return id;
};

// From the first of this month a year ago, through yesterday.
const now = new Date();
const from = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1))
	.toISOString()
	.slice(0, 10);
const to = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
const seed = dashboardSeed(from, to);

const rows = {
	reviews: [] as (typeof reviews.$inferInsert)[],
	items: [] as (typeof reviewItems.$inferInsert)[],
	food: [] as (typeof foodItemDetails.$inferInsert)[],
	foodTypes: [] as (typeof reviewItemFoodTypes.$inferInsert)[],
	drink: [] as (typeof drinkItemDetails.$inferInsert)[],
	ratings: [] as (typeof reviewCategoryRatings.$inferInsert)[]
};
for (const r of seed) {
	const reviewId = crypto.randomUUID();
	const itemId = crypto.randomUUID();
	// Midday in Phnom Penh, so the visit lands on the same local day in any nearby zone.
	const at = new Date(`${r.date}T12:00:00+07:00`);
	rows.reviews.push({
		id: reviewId,
		userId: user.id,
		placeId: need(placeId, r.placeSlug, 'place'),
		reviewType: r.item.isDrink ? 'drink' : 'food',
		visitType: r.visitType,
		mealType: r.mealType,
		visitedAt: at,
		publishedAt: at,
		overallRating: r.overall.toFixed(1),
		title: r.item.name,
		description: DASHBOARD_SEED_NOTE,
		visibility: 'private',
		reviewStatus: 'published'
	});
	rows.items.push({
		id: itemId,
		reviewId,
		itemType: r.item.isDrink ? 'drink' : 'food',
		itemName: r.item.name,
		price: r.item.price.toFixed(2),
		taxPercent: String(r.item.taxPercent),
		currencyCode: 'USD'
	});
	if (r.item.isDrink)
		rows.drink.push({
			reviewItemId: itemId,
			drinkTypeId: need(drinkTypeId, r.item.kind, 'drink type')
		});
	else {
		rows.food.push({
			reviewItemId: itemId,
			cuisineTypeId: need(cuisineId, r.item.cuisine!, 'cuisine')
		});
		rows.foodTypes.push({
			reviewItemId: itemId,
			foodTypeId: need(foodTypeId, r.item.kind, 'food type')
		});
	}
	for (const [slug, value] of Object.entries(r.scores)) {
		const itemLevel = slug === 'food-quality' || slug === 'drink-quality';
		rows.ratings.push({
			reviewId,
			reviewItemId: itemLevel ? itemId : null,
			ratingCategoryId: need(categoryId, slug, 'rating category'),
			ratingValue: value.toFixed(1)
		});
	}
}

// Chunked so no single HTTP request gets too large; parents before children.
async function insertAll<T>(table: Parameters<typeof db.insert>[0], values: T[]) {
	for (let i = 0; i < values.length; i += 300)
		await db.insert(table).values(values.slice(i, i + 300) as never);
}
try {
	await insertAll(reviews, rows.reviews);
	await insertAll(reviewItems, rows.items);
	await insertAll(foodItemDetails, rows.food);
	await insertAll(reviewItemFoodTypes, rows.foodTypes);
	await insertAll(drinkItemDetails, rows.drink);
	await insertAll(reviewCategoryRatings, rows.ratings);
} catch (e) {
	// Leave nothing half-seeded: children cascade with their reviews. A failed cleanup is
	// reported, but the original error is the one that explains what went wrong.
	try {
		await db.delete(reviews).where(
			and(
				mine,
				inArray(
					reviews.id,
					rows.reviews.map((r) => r.id!)
				)
			)
		);
	} catch (cleanup) {
		console.error('Cleanup failed; run with --remove to clear partial data.', cleanup);
	}
	throw e;
}
console.log(`Seeded ${seed.length} private reviews for ${email}, ${from} to ${to}.`);
