/**
 * Opt-in demo data for Explore: four demo accounts with *public* reviews at the seeded places, so
 * the grid, search, filters and place pages have something to show. With an email, that account
 * also follows three of them, so "People I follow" and Follow / Following have something too.
 *
 *   pnpm db:seed-explore [you@example.com]   add them (run `pnpm db:seed` first)
 *   pnpm db:seed-explore --remove            delete the demo accounts and everything of theirs
 *
 * The demo accounts are marked by a `seed-explore:` Clerk id, which no real Clerk user can have;
 * that's how --remove finds them. Their reviews' children (items, ratings) cascade.
 */
import './network.ts';
import { neon } from '@neondatabase/serverless';
import { eq, inArray, like, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../src/lib/server/db/schema/index.ts';
import { slugify } from './seed-data.ts';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const arg = process.argv[2];

const db = drizzle(neon(url), { schema });
const {
	users,
	reviews,
	reviewItems,
	foodItemDetails,
	reviewItemFoodTypes,
	drinkItemDetails,
	follows
} = schema;

const MARK = 'seed-explore:';
const seeded = like(users.clerkUserId, `${MARK}%`);

const PEOPLE = [
	{
		handle: 'darasok',
		name: 'Dara Sok',
		bio: 'Coffee every morning, tea every afternoon. I rate cafés on their iced drinks.',
		followed: true
	},
	{
		handle: 'jaiden.eats',
		name: 'Jaiden Doe',
		bio: 'Khmer food, late dinners and the occasional splurge. If it sells out by 10, I have probably reviewed it.',
		followed: true
	},
	{
		handle: 'sophea.streetfood',
		name: 'Sophea Lim',
		bio: 'Street food under $3. Markets before 8am.',
		followed: false
	},
	{
		handle: 'vannak.sips',
		name: 'Vannak Chhay',
		bio: 'Coffee and tea. Honest about overpriced oat milk.',
		followed: true
	}
] as const;

type Handle = (typeof PEOPLE)[number]['handle'];

interface SeedReview {
	by: Handle;
	place: string;
	/** Hours before now it was published. */
	hoursAgo: number;
	title: string;
	/** Food type or drink type name, as in seed-data.ts. */
	kind: string;
	/** null: a drink. */
	cuisine: string | null;
	meal: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null;
	price: number;
	overall: number;
	fav?: boolean;
	remarks: string;
}

const BROWN = 'Brown Coffee Riverside';
const REVIEWS: SeedReview[] = [
	{
		by: 'darasok',
		place: BROWN,
		hoursAgo: 5,
		title: 'Iced Sea-Salt Latte',
		kind: 'Coffee',
		cuisine: null,
		meal: null,
		price: 3.25,
		overall: 4,
		remarks:
			'The salted cream on top is the best part. Ask for less sugar, the default is sweet. Ready in under five minutes even in the morning rush.'
	},
	{
		by: 'jaiden.eats',
		place: 'Malis Restaurant',
		hoursAgo: 26,
		title: 'Fish Amok',
		kind: 'Main course',
		cuisine: 'Khmer',
		meal: 'dinner',
		price: 9,
		overall: 5,
		fav: true,
		remarks:
			"Silky and fragrant, steamed in a banana-leaf cup with just enough kroeung. The best amok I've had in the city. Book ahead on weekends."
	},
	{
		by: 'vannak.sips',
		place: 'Artillery Café',
		hoursAgo: 72,
		title: 'Iced Matcha Latte',
		kind: 'Tea',
		cuisine: null,
		meal: null,
		price: 3.75,
		overall: 3,
		remarks:
			'Nice color, weak flavor. Oat milk is 50 cents extra and it still tasted mostly of ice. The brownies here are the better order.'
	},
	{
		by: 'sophea.streetfood',
		place: 'Kinin Khmer Fusion',
		hoursAgo: 96,
		title: 'Beef Lok Lak',
		kind: 'Main course',
		cuisine: 'Khmer',
		meal: 'lunch',
		price: 7.5,
		overall: 4,
		remarks:
			'Tender beef, a peppery lime dip and a fried egg on the rice. A little salty, but the portion is big enough to share.'
	},
	{
		by: 'darasok',
		place: BROWN,
		hoursAgo: 168,
		title: 'Iced Latte',
		kind: 'Coffee',
		cuisine: null,
		meal: null,
		price: 2.75,
		overall: 4,
		fav: true,
		remarks: 'My usual. Ask for an extra shot; the default is a bit milky.'
	},
	{
		by: 'sophea.streetfood',
		place: 'The Artisan Bakery & Cafe',
		hoursAgo: 200,
		title: 'Mille-Feuille Cake',
		kind: 'Dessert',
		cuisine: 'French',
		meal: 'breakfast',
		price: 6.5,
		overall: 5,
		fav: true,
		remarks:
			"Flaky, buttery layers and a vanilla cream that isn't too sweet. Pricey for the size, but I'd come back for it with a coffee on a slow morning."
	},
	{
		by: 'jaiden.eats',
		place: 'Kinin Khmer Fusion',
		hoursAgo: 336,
		title: 'Green Mango Salad',
		kind: 'Salad',
		cuisine: 'Khmer',
		meal: 'lunch',
		price: 4,
		overall: 4,
		remarks: 'Sour, crunchy and a lot hotter than it looks. Ask for the chilli on the side.'
	},
	{
		by: 'sophea.streetfood',
		place: BROWN,
		hoursAgo: 400,
		title: 'Iced latte',
		kind: 'Coffee',
		cuisine: null,
		meal: null,
		price: 2.75,
		overall: 3,
		remarks: 'Fine, but the sea-salt one is the reason to come.'
	},
	{
		by: 'jaiden.eats',
		place: BROWN,
		hoursAgo: 504,
		title: 'Iced Palm Sugar Latte',
		kind: 'Coffee',
		cuisine: null,
		meal: null,
		price: 2.9,
		overall: 4,
		remarks: 'Caramel notes from the palm sugar without the syrupy taste. My afternoon order.'
	},
	{
		by: 'vannak.sips',
		place: 'Artillery Café',
		hoursAgo: 1300,
		title: 'Brownie',
		kind: 'Dessert',
		cuisine: 'American',
		meal: 'snack',
		price: 3.5,
		overall: 4,
		remarks: 'Fudgy middle, crackly top. Better than the matcha latte everyone orders here.'
	},
	{
		by: 'darasok',
		place: 'The Artisan Bakery & Cafe',
		hoursAgo: 1000,
		title: 'Croissant',
		kind: 'Pastry',
		cuisine: 'French',
		meal: 'breakfast',
		price: 2.8,
		overall: 4,
		remarks: 'Proper layers and very buttery. Best before 9, when they come out of the oven.'
	}
];

async function remove() {
	const ids = (await db.select({ id: users.id }).from(users).where(seeded)).map((u) => u.id);
	if (!ids.length) return 0;
	await db
		.delete(follows)
		.where(or(inArray(follows.followerId, ids), inArray(follows.followeeId, ids)));
	await db.delete(schema.reviewLikes).where(inArray(schema.reviewLikes.userId, ids));
	await db.delete(schema.reviewSaves).where(inArray(schema.reviewSaves.userId, ids));
	await db.delete(reviews).where(inArray(reviews.userId, ids));
	await db.delete(users).where(inArray(users.id, ids));
	return ids.length;
}

if (arg === '--remove') {
	console.log(`Removed ${await remove()} demo accounts and their reviews.`);
	process.exit(0);
}

const [existing] = await db.select({ id: users.id }).from(users).where(seeded).limit(1);
if (existing) throw new Error('Demo accounts already exist. Run with --remove first to reseed.');

let viewerId: string | null = null;
if (arg) {
	const [viewer] = await db.select({ id: users.id }).from(users).where(eq(users.email, arg));
	if (!viewer) throw new Error(`No user with email ${arg}. Sign in to the app once first.`);
	viewerId = viewer.id;
}

const byKey = <V>(rows: { id: V; key: string | null }[]) =>
	new Map(rows.map((r) => [String(r.key), r.id]));
const placeId = byKey(
	await db.select({ id: schema.places.id, key: schema.places.slug }).from(schema.places)
);
const cuisineId = byKey(
	await db
		.select({ id: schema.cuisineTypes.id, key: schema.cuisineTypes.name })
		.from(schema.cuisineTypes)
);
const foodTypeId = byKey(
	await db.select({ id: schema.foodTypes.id, key: schema.foodTypes.name }).from(schema.foodTypes)
);
const drinkTypeId = byKey(
	await db.select({ id: schema.drinkTypes.id, key: schema.drinkTypes.name }).from(schema.drinkTypes)
);
/** The id for `key`, or stop before inserting anything if the lookup row doesn't exist. */
const need = <V>(map: Map<string, V>, key: string, what: string): V => {
	const id = map.get(key);
	if (id === undefined)
		throw new Error(`No ${what} "${key}" in the database. Run \`pnpm db:seed\` first.`);
	return id;
};

const userId = new Map<string, string>(PEOPLE.map((p) => [p.handle, crypto.randomUUID()]));
const rows = {
	reviews: [] as (typeof reviews.$inferInsert)[],
	items: [] as (typeof reviewItems.$inferInsert)[],
	food: [] as (typeof foodItemDetails.$inferInsert)[],
	foodTypes: [] as (typeof reviewItemFoodTypes.$inferInsert)[],
	drink: [] as (typeof drinkItemDetails.$inferInsert)[]
};
const now = Date.now();
for (const r of REVIEWS) {
	const reviewId = crypto.randomUUID();
	const itemId = crypto.randomUUID();
	const at = new Date(now - r.hoursAgo * 3_600_000);
	const isDrink = r.cuisine === null;
	rows.reviews.push({
		id: reviewId,
		userId: userId.get(r.by)!,
		placeId: need(placeId, slugify(r.place), 'place'),
		reviewType: isDrink ? 'drink' : 'food',
		visitType: 'dine_in',
		mealType: r.meal,
		visitedAt: at,
		publishedAt: at,
		overallRating: r.overall.toFixed(1),
		title: r.title,
		description: r.remarks,
		isFavorite: r.fav ?? false,
		visibility: 'public',
		reviewStatus: 'published'
	});
	rows.items.push({
		id: itemId,
		reviewId,
		itemType: isDrink ? 'drink' : 'food',
		itemName: r.title,
		price: r.price.toFixed(2),
		currencyCode: 'USD'
	});
	if (isDrink) {
		rows.drink.push({ reviewItemId: itemId, drinkTypeId: need(drinkTypeId, r.kind, 'drink type') });
	} else {
		rows.food.push({ reviewItemId: itemId, cuisineTypeId: need(cuisineId, r.cuisine!, 'cuisine') });
		rows.foodTypes.push({
			reviewItemId: itemId,
			foodTypeId: need(foodTypeId, r.kind, 'food type')
		});
	}
}

try {
	await db.insert(users).values(
		PEOPLE.map((p) => ({
			id: userId.get(p.handle)!,
			clerkUserId: `${MARK}${p.handle}`,
			username: p.handle,
			email: `${p.handle}@seed.invalid`,
			displayName: p.name,
			bio: p.bio
		}))
	);
	await db.insert(reviews).values(rows.reviews);
	await db.insert(reviewItems).values(rows.items);
	await db.insert(foodItemDetails).values(rows.food);
	await db.insert(reviewItemFoodTypes).values(rows.foodTypes);
	await db.insert(drinkItemDetails).values(rows.drink);
	if (viewerId) {
		await db.insert(follows).values(
			PEOPLE.filter((p) => p.followed).map((p) => ({
				followerId: viewerId!,
				followeeId: userId.get(p.handle)!
			}))
		);
	}
} catch (e) {
	// Leave nothing half-seeded. A failed cleanup is reported, but the original error is the
	// one that explains what went wrong.
	try {
		await remove();
	} catch (cleanup) {
		console.error('Cleanup failed; run with --remove to clear partial data.', cleanup);
	}
	throw e;
}

console.log(
	`Seeded ${PEOPLE.length} demo accounts with ${REVIEWS.length} public reviews` +
		(viewerId ? `; ${arg} follows ${PEOPLE.filter((p) => p.followed).length} of them.` : '.')
);
