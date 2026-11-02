/**
 * The Log's data layer. A day's list is the viewer's own logs plus their live reviews, each review
 * item shown as a log that carries `reviewId`; logs already published as a review are left out
 * so a meal is never listed twice. Suggestions are ranked in log/suggest.ts from the history
 * fetched here.
 */
import { and, count, desc, eq, gte, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import { addDays, monthGrid, zonedDayStart } from '#lib/dashboard/period.ts';
import type { LogVisitInput } from '#lib/log/schema.ts';
import type { HistoryRow, PlaceRow } from '#lib/log/suggest.ts';
import { lineTotal, type DiningType, type LogEntry, type MealType } from '#lib/log/visits.ts';
import { live } from './dashboard.ts';
import { db } from './db/index.ts';
import {
	cuisineTypes,
	drinkTypes,
	foodTypes,
	logs,
	places,
	reviewItems,
	reviews
} from './db/schema/index.ts';
import { toNumber } from './feed.ts';

export type LogRow = typeof logs.$inferSelect;

const localDate = (d: Date, tz: string) => d.toLocaleDateString('en-CA', { timeZone: tz });

/** Reviews have more visit types than the Log: a drive-through is a takeaway. */
const DINING_OF: Record<string, DiningType> = {
	dine_in: 'dine_in',
	takeaway: 'takeaway',
	delivery: 'delivery',
	drive_through: 'takeaway',
	other: 'dine_in'
};

export function toLogEntry(r: {
	id: string;
	loggedOn: string;
	place: string;
	title: string;
	itemType: string;
	qty: number;
	price: string;
	mealType: string;
	visitType: string;
	overallRating: number;
	note: string | null;
}): LogEntry {
	return {
		id: r.id,
		date: r.loggedOn,
		place: r.place,
		title: r.title,
		itemType: r.itemType === 'drink' ? 'drink' : 'food',
		qty: r.qty,
		price: toNumber(r.price) ?? 0,
		meal: r.mealType as MealType,
		dining: r.visitType as DiningType,
		overall: r.overallRating,
		note: r.note,
		reviewId: null
	};
}

/** One review item as a log. The price includes tax, as the dashboard counts it; a drink-only
 *  review has no meal, so it files under snack. */
export function reviewItemToEntry(
	r: {
		reviewId: string;
		visitedAt: Date;
		placeName: string;
		visitType: string;
		mealType: string | null;
		overall: string;
	},
	i: {
		id: string;
		itemType: string;
		itemName: string;
		price: string | null;
		taxPercent: string | null;
	},
	tz: string
): LogEntry {
	return {
		id: i.id,
		date: localDate(r.visitedAt, tz),
		place: r.placeName,
		title: i.itemName,
		itemType: i.itemType === 'drink' ? 'drink' : 'food',
		qty: 1,
		price: (toNumber(i.price) ?? 0) * (1 + (toNumber(i.taxPercent) ?? 0) / 100),
		meal: (r.mealType as MealType | null) ?? 'snack',
		dining: DINING_OF[r.visitType] ?? 'dine_in',
		overall: toNumber(r.overall) ?? 0,
		note: null,
		reviewId: r.reviewId
	};
}

const placeName = sql<string>`coalesce(${places.name}, ${logs.placeName})`;

/** Everything on the viewer's calendar for one month ("YYYY-MM"), oldest first. */
export async function getLogMonth(userId: string, month: string, tz: string): Promise<LogEntry[]> {
	const { days } = monthGrid(month);
	const first = days[0]!;
	const last = days[days.length - 1]!;
	const inRange = and(
		live(userId),
		gte(reviews.visitedAt, zonedDayStart(first, tz)),
		lt(reviews.visitedAt, zonedDayStart(addDays(last, 1), tz))
	);

	const [own, reviewRows, itemRows] = await db.batch([
		db
			.select({
				id: logs.id,
				loggedOn: logs.loggedOn,
				place: placeName,
				title: logs.title,
				itemType: logs.itemType,
				qty: logs.qty,
				price: logs.price,
				mealType: logs.mealType,
				visitType: logs.visitType,
				overallRating: logs.overallRating,
				note: logs.note
			})
			.from(logs)
			.leftJoin(places, eq(logs.placeId, places.id))
			.where(
				and(
					eq(logs.userId, userId),
					isNull(logs.reviewId),
					gte(logs.loggedOn, first),
					lte(logs.loggedOn, last)
				)
			)
			.orderBy(logs.loggedOn, logs.createdAt),
		db
			.select({
				reviewId: reviews.id,
				visitedAt: reviews.visitedAt,
				placeName: places.name,
				visitType: reviews.visitType,
				mealType: reviews.mealType,
				overall: reviews.overallRating
			})
			.from(reviews)
			.innerJoin(places, eq(reviews.placeId, places.id))
			.where(inRange)
			.orderBy(reviews.visitedAt),
		db
			.select({
				id: reviewItems.id,
				reviewId: reviewItems.reviewId,
				itemType: reviewItems.itemType,
				itemName: reviewItems.itemName,
				price: reviewItems.price,
				taxPercent: reviewItems.taxPercent
			})
			.from(reviewItems)
			.innerJoin(reviews, eq(reviewItems.reviewId, reviews.id))
			.where(inRange)
			.orderBy(reviewItems.displayOrder)
	]);

	const review = new Map(reviewRows.map((r) => [r.reviewId, r]));
	const fromReviews = itemRows.flatMap((i) => {
		const r = review.get(i.reviewId);
		return r ? [reviewItemToEntry(r, i, tz)] : [];
	});
	return [...own.map(toLogEntry), ...fromReviews].sort((a, b) => a.date.localeCompare(b.date));
}

/** How many logs fall on each local day, ever: the calendar's dots, the streak and the first day. */
export async function getDayCounts(userId: string, tz: string): Promise<Record<string, number>> {
	const reviewDay = sql<string>`to_char(${reviews.visitedAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD')`;
	const [own, reviewed] = await db.batch([
		db
			.select({ day: logs.loggedOn, n: count() })
			.from(logs)
			.where(and(eq(logs.userId, userId), isNull(logs.reviewId)))
			.groupBy(logs.loggedOn),
		db
			.select({ day: reviewDay, n: count() })
			.from(reviewItems)
			.innerJoin(reviews, eq(reviewItems.reviewId, reviews.id))
			.where(live(userId))
			.groupBy(sql`1`)
	]);
	const counts: Record<string, number> = {};
	for (const r of [...own, ...reviewed]) counts[r.day] = (counts[r.day] ?? 0) + r.n;
	return counts;
}

/** Saves a visit: one log per item, each with its line total. Returns the new ids. */
export async function createLogs(userId: string, visit: LogVisitInput): Promise<string[]> {
	const where =
		visit.place.kind === 'existing'
			? { placeId: visit.place.placeId, placeName: null }
			: { placeId: null, placeName: visit.place.name };
	const rows = await db
		.insert(logs)
		.values(
			visit.items.map((i) => {
				const food = i.itemType === 'food';
				return {
					userId,
					loggedOn: visit.date,
					...where,
					title: i.title,
					itemType: i.itemType,
					foodTypeId: food ? i.foodTypeId : null,
					drinkTypeId: food ? null : i.drinkTypeId,
					cuisineTypeId: food ? i.cuisineTypeId : null,
					qty: i.qty,
					price: lineTotal(i.price, i.qty, i.taxPercent ?? 0).toFixed(2),
					taxPercent: i.taxPercent === null ? null : i.taxPercent.toFixed(2),
					isFavorite: i.isFavorite,
					mealType: visit.meal,
					visitType: visit.dining,
					overallRating: visit.overall,
					note: visit.note
				};
			})
		)
		.returning({ id: logs.id });
	return rows.map((r) => r.id);
}

/** Deletes the viewer's own logs and hands the rows back, so Undo can restore them. A log
 *  that became a review is left alone: the review is what's listed. */
export async function deleteLogs(userId: string, ids: string[]): Promise<LogRow[]> {
	if (!ids.length) return [];
	return db
		.delete(logs)
		.where(and(eq(logs.userId, userId), inArray(logs.id, ids), isNull(logs.reviewId)))
		.returning();
}

/** Puts back rows from {@link deleteLogs}, always as the viewer's own. */
export async function restoreLogs(userId: string, rows: LogRow[]): Promise<void> {
	if (!rows.length) return;
	await db
		.insert(logs)
		.values(rows.map((r) => ({ ...r, userId, reviewId: null })))
		.onConflictDoNothing();
}

/** Every past item, newest first, capped: the pool the form's suggestions are ranked from. */
export async function getItemHistory(userId: string, limit = 500): Promise<HistoryRow[]> {
	const rows = await db
		.select({
			title: logs.title,
			itemType: logs.itemType,
			foodTypeId: logs.foodTypeId,
			drinkTypeId: logs.drinkTypeId,
			cuisineTypeId: logs.cuisineTypeId,
			foodType: foodTypes.name,
			drinkType: drinkTypes.name,
			cuisine: cuisineTypes.name,
			place: placeName,
			qty: logs.qty,
			price: logs.price,
			taxPercent: logs.taxPercent
		})
		.from(logs)
		.leftJoin(places, eq(logs.placeId, places.id))
		.leftJoin(foodTypes, eq(logs.foodTypeId, foodTypes.id))
		.leftJoin(drinkTypes, eq(logs.drinkTypeId, drinkTypes.id))
		.leftJoin(cuisineTypes, eq(logs.cuisineTypeId, cuisineTypes.id))
		.where(eq(logs.userId, userId))
		.orderBy(desc(logs.loggedOn), desc(logs.createdAt))
		.limit(limit);
	return rows.map((r) => ({
		title: r.title,
		itemType: r.itemType === 'drink' ? 'drink' : 'food',
		foodTypeId: r.foodTypeId,
		drinkTypeId: r.drinkTypeId,
		cuisineTypeId: r.cuisineTypeId,
		kind: r.itemType === 'drink' ? r.drinkType : r.foodType,
		cuisine: r.cuisine,
		place: r.place,
		qty: r.qty,
		price: toNumber(r.price) ?? 0,
		taxPercent: toNumber(r.taxPercent)
	}));
}

/** One row per log and per live review, so the count of a place's rows is its visits. */
export async function getPlaceHistory(userId: string): Promise<PlaceRow[]> {
	const address = sql<
		string | null
	>`nullif(concat_ws(', ', ${places.addressLine1}, ${places.city}), '')`;
	const [own, reviewed] = await db.batch([
		db
			.select({ place: placeName, placeId: logs.placeId, address })
			.from(logs)
			.leftJoin(places, eq(logs.placeId, places.id))
			.where(and(eq(logs.userId, userId), isNull(logs.reviewId))),
		db
			.select({ place: places.name, placeId: reviews.placeId, address })
			.from(reviews)
			.innerJoin(places, eq(reviews.placeId, places.id))
			.where(live(userId))
	]);
	return [...own, ...reviewed];
}
