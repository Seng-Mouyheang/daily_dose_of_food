/**
 * The dashboard's read path: the viewer's live published reviews in a date range, flattened into
 * DashLog rows for dashboard/summary.ts. One batch: the review spine, its items (with type and
 * cuisine names), its rating rows, and each place's first-ever visit.
 */
import { and, eq, gte, inArray, isNull, lt, min } from 'drizzle-orm';
import type { DashLog } from '#lib/dashboard/summary.ts';
import { db } from './db/index.ts';
import {
	cuisineTypes,
	drinkItemDetails,
	drinkTypes,
	foodItemDetails,
	foodTypes,
	places,
	ratingCategories,
	reviewCategoryRatings,
	reviewItemFoodTypes,
	reviewItems,
	reviews,
	users
} from './db/schema/index.ts';
import { toNumber } from './feed.ts';

/** Which rating-category slugs feed each dashboard sub-score. */
const SCORE_SLUGS = {
	food: ['food-quality', 'drink-quality'],
	value: ['price'],
	service: ['service'],
	hygiene: ['hygiene']
} as const;

const live = (userId: string) =>
	and(
		eq(reviews.userId, userId),
		eq(reviews.reviewStatus, 'published'),
		isNull(reviews.deletedAt),
		isNull(reviews.archivedAt)
	);

const localDate = (d: Date, tz: string) => d.toLocaleDateString('en-CA', { timeZone: tz });

export async function getDashboardData(userId: string, from: Date, to: Date, tz: string) {
	const inRange = and(live(userId), gte(reviews.visitedAt, from), lt(reviews.visitedAt, to));

	const [spine, items, foodTypeRows, ratingRows, firstVisits] = await db.batch([
		db
			.select({
				id: reviews.id,
				visitedAt: reviews.visitedAt,
				title: reviews.title,
				placeId: places.id,
				placeName: places.name,
				visitType: reviews.visitType,
				mealType: reviews.mealType,
				overall: reviews.overallRating
			})
			.from(reviews)
			.innerJoin(places, eq(reviews.placeId, places.id))
			.where(inRange),
		db
			.select({
				id: reviewItems.id,
				reviewId: reviewItems.reviewId,
				itemType: reviewItems.itemType,
				itemName: reviewItems.itemName,
				price: reviewItems.price,
				taxPercent: reviewItems.taxPercent,
				cuisineName: cuisineTypes.name,
				drinkTypeName: drinkTypes.name
			})
			.from(reviewItems)
			.innerJoin(reviews, eq(reviewItems.reviewId, reviews.id))
			.leftJoin(foodItemDetails, eq(foodItemDetails.reviewItemId, reviewItems.id))
			.leftJoin(cuisineTypes, eq(foodItemDetails.cuisineTypeId, cuisineTypes.id))
			.leftJoin(drinkItemDetails, eq(drinkItemDetails.reviewItemId, reviewItems.id))
			.leftJoin(drinkTypes, eq(drinkItemDetails.drinkTypeId, drinkTypes.id))
			.where(inRange)
			.orderBy(reviewItems.displayOrder),
		db
			.select({ reviewItemId: reviewItemFoodTypes.reviewItemId, name: foodTypes.name })
			.from(reviewItemFoodTypes)
			.innerJoin(reviewItems, eq(reviewItemFoodTypes.reviewItemId, reviewItems.id))
			.innerJoin(reviews, eq(reviewItems.reviewId, reviews.id))
			.innerJoin(foodTypes, eq(reviewItemFoodTypes.foodTypeId, foodTypes.id))
			.where(inRange),
		db
			.select({
				reviewId: reviewCategoryRatings.reviewId,
				slug: ratingCategories.slug,
				value: reviewCategoryRatings.ratingValue
			})
			.from(reviewCategoryRatings)
			.innerJoin(reviews, eq(reviewCategoryRatings.reviewId, reviews.id))
			.innerJoin(ratingCategories, eq(reviewCategoryRatings.ratingCategoryId, ratingCategories.id))
			.where(and(inRange, inArray(ratingCategories.slug, Object.values(SCORE_SLUGS).flat()))),
		db
			.select({ placeId: reviews.placeId, first: min(reviews.visitedAt) })
			.from(reviews)
			.where(live(userId))
			.groupBy(reviews.placeId)
	]);

	// An item can have several food types; the first is what the card shows, so it's the one
	// the spend is filed under.
	const foodTypeOf = new Map<string, string>();
	for (const r of foodTypeRows)
		if (!foodTypeOf.has(r.reviewItemId)) foodTypeOf.set(r.reviewItemId, r.name);

	// Grouped once, so each review looks up its own ratings instead of scanning all of them.
	const ratingsOf = new Map<string, typeof ratingRows>();
	for (const x of ratingRows) ratingsOf.set(x.reviewId, [...(ratingsOf.get(x.reviewId) ?? []), x]);

	const itemsOf = new Map<string, typeof items>();
	for (const i of items) itemsOf.set(i.reviewId, [...(itemsOf.get(i.reviewId) ?? []), i]);

	const logs: DashLog[] = spine.map((r) => {
		const own = itemsOf.get(r.id) ?? [];
		const score = (slugs: readonly string[]) => {
			const vals = (ratingsOf.get(r.id) ?? [])
				.filter((x) => slugs.includes(x.slug))
				.flatMap((x) => (toNumber(x.value) === null ? [] : [toNumber(x.value)!]));
			return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
		};
		return {
			id: r.id,
			date: localDate(r.visitedAt, tz),
			title: r.title?.trim() || own.map((i) => i.itemName).join(' & ') || 'Untitled',
			placeId: r.placeId,
			placeName: r.placeName,
			visitType: r.visitType,
			mealType: r.mealType,
			overall: toNumber(r.overall) ?? 0,
			items: own.map((i) => ({
				isDrink: i.itemType === 'drink',
				kind: i.itemType === 'drink' ? i.drinkTypeName : (foodTypeOf.get(i.id) ?? null),
				cuisine: i.itemType === 'drink' ? null : i.cuisineName,
				price: (toNumber(i.price) ?? 0) * (1 + (toNumber(i.taxPercent) ?? 0) / 100)
			})),
			scores: {
				food: score(SCORE_SLUGS.food),
				value: score(SCORE_SLUGS.value),
				service: score(SCORE_SLUGS.service),
				hygiene: score(SCORE_SLUGS.hygiene)
			}
		};
	});

	const firstVisitByPlace = new Map(
		firstVisits.flatMap((f) => (f.first ? [[f.placeId, localDate(f.first, tz)] as const] : []))
	);
	const firstLog = [...firstVisitByPlace.values()].sort()[0] ?? null;

	return { logs, firstVisitByPlace, firstLog };
}

export async function setMonthlyBudget(userId: string, budget: number | null) {
	await db
		.update(users)
		.set({ monthlyBudget: budget === null ? null : budget.toFixed(2) })
		.where(eq(users.id, userId));
}
