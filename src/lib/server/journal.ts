/**
 * The journal's read path: the viewer's own reviews (active or archived) and the reviews they
 * have bookmarked. Same "spine then children" shape as feed.ts — one query for the page of
 * reviews, then getReviewChildren's single batch for everything hanging off them — so a journal
 * row and a feed card are built from identical data and the desktop preview pane needs no
 * second fetch.
 *
 * Search, sort and filter happen here, in SQL, from URL params (see journal/query.ts), so a
 * filtered list survives a reload and pages correctly past the first twenty.
 */
import type { SQL } from 'drizzle-orm';
import {
	and,
	asc,
	count,
	desc,
	eq,
	exists,
	gt,
	ilike,
	isNotNull,
	isNull,
	lt,
	ne,
	or,
	sql
} from 'drizzle-orm';
import type { FeedReview } from '#lib/review/card.ts';
import type { JournalCursor, JournalQuery } from '#lib/journal/query.ts';
import { db } from './db/index.ts';
import { places, reviewItems, reviews, reviewSaves, users } from './db/schema/index.ts';
import { assembleReview, getReviewChildren } from './feed.ts';

export interface JournalCounts {
	/** Active (not archived) published reviews. */
	mine: number;
	archived: number;
	saved: number;
}

export interface JournalPage {
	items: FeedReview[];
	nextCursor: JournalCursor | null;
}

const PAGE_SIZE = 20;

/** The same columns feed.ts's spine selects, so assembleReview accepts the rows as-is. */
const spineColumns = {
	id: reviews.id,
	userId: reviews.userId,
	visibility: reviews.visibility,
	reviewStatus: reviews.reviewStatus,
	deletedAt: reviews.deletedAt,
	archivedAt: reviews.archivedAt,
	reviewType: reviews.reviewType,
	visitType: reviews.visitType,
	mealType: reviews.mealType,
	visitedAt: reviews.visitedAt,
	publishedAt: reviews.publishedAt,
	overallRating: reviews.overallRating,
	title: reviews.title,
	description: reviews.description,
	isFavorite: reviews.isFavorite,
	authorDisplayName: users.displayName,
	authorAvatarUrl: users.avatarUrl,
	placeId: places.id,
	placeName: places.name,
	placeAddressLine1: places.addressLine1,
	placeCity: places.city
};

/** A user's search text as an ILIKE pattern, with its own `%`, `_` and `\` taken literally. */
function likePattern(q: string): string {
	return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function searchCondition(q: string, includeAuthor: boolean): SQL | undefined {
	if (!q) return undefined;
	const pattern = likePattern(q);
	return or(
		ilike(reviews.title, pattern),
		ilike(places.name, pattern),
		exists(
			db
				.select({ one: sql`1` })
				.from(reviewItems)
				.where(and(eq(reviewItems.reviewId, reviews.id), ilike(reviewItems.itemName, pattern)))
		),
		includeAuthor ? ilike(users.displayName, pattern) : undefined
	);
}

function filterCondition(filter: JournalQuery['filter']): SQL | undefined {
	switch (filter) {
		case 'favorites':
			return eq(reviews.isFavorite, true);
		// A review of both a dish and a drink is listed under both chips.
		case 'dishes':
			return ne(reviews.reviewType, 'drink');
		case 'drinks':
			return ne(reviews.reviewType, 'food');
		default:
			return undefined;
	}
}

type DateCol = typeof reviews.visitedAt | typeof reviewSaves.createdAt;

/** Pre-tax total across a review's items, 0 when none has a price — what the row shows. */
const priceExpr = sql<string>`(select coalesce(sum(${reviewItems.price}), 0) from ${reviewItems} where ${reviewItems.reviewId} = ${reviews.id})`;

/**
 * Each sort as (optional value column, its direction, then date + id direction). The date is
 * the visit date on My reviews and the save date on Bookmarks; ties on rating or price fall
 * back to newest first.
 */
function sortSpec(sort: JournalQuery['sort']): {
	value: SQL | null;
	valueDir: 'asc' | 'desc';
	dateDir: 'asc' | 'desc';
} {
	switch (sort) {
		case 'oldest':
			return { value: null, valueDir: 'asc', dateDir: 'asc' };
		case 'top':
			return { value: sql`${reviews.overallRating}`, valueDir: 'desc', dateDir: 'desc' };
		case 'lowest':
			return { value: sql`${reviews.overallRating}`, valueDir: 'asc', dateDir: 'desc' };
		case 'price_desc':
			return { value: priceExpr, valueDir: 'desc', dateDir: 'desc' };
		case 'price_asc':
			return { value: priceExpr, valueDir: 'asc', dateDir: 'desc' };
		default:
			return { value: null, valueDir: 'desc', dateDir: 'desc' };
	}
}

/** Keyset "after the cursor" for whichever sort is active. */
function afterCursor(query: JournalQuery, dateCol: DateCol): SQL | undefined {
	const c = query.cursor;
	if (!c) return undefined;
	const spec = sortSpec(query.sort);
	const past = (dir: 'asc' | 'desc') => (dir === 'desc' ? lt : gt);
	const t = new Date(c.t);
	const byDate = or(
		past(spec.dateDir)(dateCol, t),
		and(eq(dateCol, t), past(spec.dateDir)(reviews.id, c.id))
	);
	if (!spec.value || c.v === undefined) return byDate;
	// Ratings and prices both have at most 2 decimals, so a fixed 2dp string matches the
	// numeric value exactly and ties at a page boundary are neither skipped nor repeated.
	const v = c.v.toFixed(2);
	return or(past(spec.valueDir)(spec.value, v), and(eq(spec.value, v), byDate));
}

function orderFor(query: JournalQuery, dateCol: DateCol) {
	const spec = sortSpec(query.sort);
	const by = (dir: 'asc' | 'desc') => (dir === 'desc' ? desc : asc);
	const tail = [by(spec.dateDir)(dateCol), by(spec.dateDir)(reviews.id)];
	return spec.value ? [by(spec.valueDir)(spec.value), ...tail] : tail;
}

/** Built from the last row of a full page; null when there is no next page. */
function nextCursorFrom(
	rows: { id: string; sortDate: Date; sortValue: unknown }[]
): JournalCursor | null {
	if (rows.length <= PAGE_SIZE) return null;
	const last = rows[PAGE_SIZE - 1]!;
	return {
		t: last.sortDate.toISOString(),
		id: last.id,
		...(last.sortValue == null ? {} : { v: Number(last.sortValue) })
	};
}

/** The author's own live reviews. Archived and active are separate lists, never mixed. */
function mineBase(userId: string, archived: boolean) {
	return and(
		eq(reviews.userId, userId),
		eq(reviews.reviewStatus, 'published'),
		isNull(reviews.deletedAt),
		archived ? isNotNull(reviews.archivedAt) : isNull(reviews.archivedAt)
	);
}

/**
 * A bookmark is listed only while the viewer could still open the review: public, published,
 * live, not archived by its author, and by an author who still exists. A review that turned
 * private after being saved just drops out of the list (the save row stays, so it comes back
 * if the author makes it public again).
 */
function bookmarkBase(userId: string) {
	return and(
		eq(reviewSaves.userId, userId),
		// Anyone's public review, or one of your own at any visibility — bookmarking your own
		// review from the feed should land here too.
		eq(reviews.reviewStatus, 'published'),
		or(eq(reviews.visibility, 'public'), eq(reviews.userId, userId)),
		isNull(reviews.deletedAt),
		isNull(reviews.archivedAt),
		isNull(users.deletedAt)
	);
}

export async function getMyReviews(userId: string, query: JournalQuery): Promise<JournalPage> {
	const rows = await db
		.select({
			...spineColumns,
			sortDate: reviews.visitedAt,
			sortValue: sortSpec(query.sort).value ?? sql<null>`null`
		})
		.from(reviews)
		.innerJoin(users, eq(reviews.userId, users.id))
		.innerJoin(places, eq(reviews.placeId, places.id))
		.where(
			and(
				mineBase(userId, query.archived),
				searchCondition(query.q, false),
				filterCondition(query.filter),
				afterCursor(query, reviews.visitedAt)
			)
		)
		.orderBy(...orderFor(query, reviews.visitedAt))
		.limit(PAGE_SIZE + 1);

	return finish(rows, query, userId);
}

export async function getBookmarks(userId: string, query: JournalQuery): Promise<JournalPage> {
	const rows = await db
		.select({
			...spineColumns,
			sortDate: reviewSaves.createdAt,
			sortValue: sortSpec(query.sort).value ?? sql<null>`null`
		})
		.from(reviewSaves)
		.innerJoin(reviews, eq(reviewSaves.reviewId, reviews.id))
		.innerJoin(users, eq(reviews.userId, users.id))
		.innerJoin(places, eq(reviews.placeId, places.id))
		.where(
			and(
				bookmarkBase(userId),
				searchCondition(query.q, true),
				filterCondition(query.filter),
				afterCursor(query, reviewSaves.createdAt)
			)
		)
		.orderBy(...orderFor(query, reviewSaves.createdAt))
		.limit(PAGE_SIZE + 1);

	return finish(rows, query, userId);
}

async function finish(
	rows: (Parameters<typeof assembleReview>[0] & { sortDate: Date; sortValue: unknown })[],
	query: JournalQuery,
	userId: string
): Promise<JournalPage> {
	const page = rows.slice(0, PAGE_SIZE);
	const children = await getReviewChildren(
		page.map((r) => r.id),
		userId
	);
	return {
		items: page.map((row) => assembleReview(row, children)),
		nextCursor: nextCursorFrom(rows)
	};
}

/** The tab badges and the "Archived reviews (n)" link, in one round trip. Unfiltered on
 *  purpose: a badge counts what's in the tab, not what the current search happens to match. */
export async function getJournalCounts(userId: string): Promise<JournalCounts> {
	const [[mine], [archived], [saved]] = await db.batch([
		db.select({ n: count() }).from(reviews).where(mineBase(userId, false)),
		db.select({ n: count() }).from(reviews).where(mineBase(userId, true)),
		db
			.select({ n: count() })
			.from(reviewSaves)
			.innerJoin(reviews, eq(reviewSaves.reviewId, reviews.id))
			.innerJoin(users, eq(reviews.userId, users.id))
			.where(bookmarkBase(userId))
	]);
	return { mine: mine?.n ?? 0, archived: archived?.n ?? 0, saved: saved?.n ?? 0 };
}
