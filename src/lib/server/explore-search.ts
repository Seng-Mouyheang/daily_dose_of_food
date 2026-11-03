/**
 * Explore search: food, people and places matching a query. The query arrives normalized
 * (search.ts `normalizeQuery`: lowercase, accents and a leading @ stripped) and each column is
 * folded the same way in SQL — `unaccent(lower(…))` — so "pate" finds "Pâté" on both sides.
 *
 * Food reuses Explore's feed (its filters, sorts and paging) with one more condition, so the Food
 * tab is the Explore grid narrowed. People and places are capped lists, not paged: the tabs show
 * the top matches, and a search narrow enough to read is short anyway.
 */
import type { SQL, SQLWrapper } from 'drizzle-orm';
import { and, avg, count, desc, eq, exists, isNull, ne, or, sql } from 'drizzle-orm';
import { placeScore, type PersonResult, type PlaceResult } from '#lib/explore/search.ts';
import { db } from './db/index.ts';
import {
	cuisineTypes,
	drinkItemDetails,
	drinkTypes,
	follows,
	foodItemDetails,
	foodTypes,
	places,
	reviewItemFoodTypes,
	reviewItems,
	reviews,
	users
} from './db/schema/index.ts';
import { listedReview, NOBODY_ID, toNumber } from './feed.ts';

const LIST_LIMIT = 50;

/** The query for LIKE, with LIKE's own wildcards (and its escape) taken literally. */
function literal(q: string): string {
	return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** `column`, folded like the query, contains it. */
function has(column: SQLWrapper, q: string): SQL {
	return sql`unaccent(lower(${column})) like ${`%${literal(q)}%`}`;
}

function startsWith(column: SQLWrapper, q: string): SQL {
	return sql`unaccent(lower(${column})) like ${`${literal(q)}%`}`;
}

/** Reviews whose title, place, or any item's name, dish or drink type or cuisine matches. For
 *  `getExploreFeed`'s `search`; it has `reviews` and `places` joined. */
export function foodMatches(q: string): SQL {
	const item = (where: SQL) =>
		exists(
			db
				.select({ one: sql`1` })
				.from(reviewItems)
				.leftJoin(foodItemDetails, eq(foodItemDetails.reviewItemId, reviewItems.id))
				.leftJoin(cuisineTypes, eq(cuisineTypes.id, foodItemDetails.cuisineTypeId))
				.leftJoin(drinkItemDetails, eq(drinkItemDetails.reviewItemId, reviewItems.id))
				.leftJoin(drinkTypes, eq(drinkTypes.id, drinkItemDetails.drinkTypeId))
				.where(and(eq(reviewItems.reviewId, reviews.id), where))
		);
	return or(
		has(reviews.title, q),
		has(places.name, q),
		item(
			or(
				has(reviewItems.itemName, q),
				has(cuisineTypes.name, q),
				has(drinkTypes.name, q),
				exists(
					db
						.select({ one: sql`1` })
						.from(reviewItemFoodTypes)
						.innerJoin(foodTypes, eq(foodTypes.id, reviewItemFoodTypes.foodTypeId))
						.where(
							and(eq(reviewItemFoodTypes.reviewItemId, reviewItems.id), has(foodTypes.name, q))
						)
				)
			)!
		)
	)!;
}

/** How many reviews match before Explore's filters narrow them: the Food tab's count. */
export async function countFood(q: string): Promise<number> {
	const [row] = await db
		.select({ n: count() })
		.from(reviews)
		.innerJoin(users, eq(reviews.userId, users.id))
		.innerJoin(places, eq(reviews.placeId, places.id))
		.where(and(listedReview, foodMatches(q)));
	return row?.n ?? 0;
}

/**
 * People whose name or username matches. The viewer never appears in their own results, nor does
 * a deleted account. A name or username starting with the query ranks first, then more followers.
 */
export async function searchPeople(q: string, viewerId: string | null): Promise<PersonResult[]> {
	// Counts as grouped subqueries joined in, not correlated subqueries in the select: drizzle
	// leaves column names unqualified in a query with no joins, so a correlated `users.id` would
	// silently bind to the subquery's own table.
	const reviewCounts = db
		.select({ userId: reviews.userId, n: count().as('review_n') })
		.from(reviews)
		.innerJoin(users, eq(reviews.userId, users.id))
		.where(listedReview)
		.groupBy(reviews.userId)
		.as('review_counts');
	const followerCounts = db
		.select({ userId: follows.followeeId, n: count().as('follower_n') })
		.from(follows)
		.groupBy(follows.followeeId)
		.as('follower_counts');
	const viewerFollows = db
		.select({ userId: follows.followeeId })
		.from(follows)
		.where(eq(follows.followerId, viewerId ?? NOBODY_ID))
		.as('viewer_follows');

	const followers = sql<number>`coalesce(${followerCounts.n}, 0)::int`;
	const prefix = or(startsWith(users.displayName, q), startsWith(users.username, q));

	const rows = await db
		.select({
			id: users.id,
			displayName: users.displayName,
			username: users.username,
			avatarUrl: users.avatarUrl,
			bio: users.bio,
			reviewCount: sql<number>`coalesce(${reviewCounts.n}, 0)::int`,
			followers,
			youFollow: sql<boolean>`${viewerFollows.userId} is not null`
		})
		.from(users)
		.leftJoin(reviewCounts, eq(reviewCounts.userId, users.id))
		.leftJoin(followerCounts, eq(followerCounts.userId, users.id))
		.leftJoin(viewerFollows, eq(viewerFollows.userId, users.id))
		.where(
			and(
				isNull(users.deletedAt),
				eq(users.accountStatus, 'active'),
				viewerId ? ne(users.id, viewerId) : undefined,
				// blocks: leave out anyone the viewer blocked, or who blocked them, once blocks exist.
				or(has(users.displayName, q), has(users.username, q))
			)
		)
		.orderBy(desc(sql`${prefix}`), desc(followers), users.displayName)
		.limit(LIST_LIMIT);

	return rows.map((r) => ({ ...r, username: String(r.username), youFollow: Boolean(r.youFollow) }));
}

/**
 * Places with at least one public review whose name — or, from 4 characters, address — matches.
 * Ranked by `placeScore` (name before address), then by more reviews.
 */
export async function searchPlaces(q: string): Promise<PlaceResult[]> {
	const address = sql<
		string | null
	>`nullif(concat_ws(', ', ${places.addressLine1}, ${places.city}), '')`;

	const rows = await db
		.select({
			id: places.id,
			name: places.name,
			address,
			average: avg(reviews.overallRating),
			reviewCount: count()
		})
		.from(reviews)
		.innerJoin(users, eq(reviews.userId, users.id))
		.innerJoin(places, eq(reviews.placeId, places.id))
		.where(and(listedReview, or(has(places.name, q), q.length >= 4 ? has(address, q) : undefined)))
		.groupBy(places.id, places.name, places.addressLine1, places.city);

	const scored = rows.map((r) => ({
		place: { ...r, average: toNumber(r.average) ?? 0 },
		score: placeScore(r.name, r.address, q)
	}));
	return scored
		.filter((r) => r.score > 0)
		.sort((a, b) => b.score - a.score || b.place.reviewCount - a.place.reviewCount)
		.slice(0, LIST_LIMIT)
		.map((r) => r.place);
}
