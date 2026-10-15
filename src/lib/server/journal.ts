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
	count,
	desc,
	eq,
	exists,
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

/**
 * Keyset "after the cursor" for the two sort orders. `dateCol` is the visit date on My reviews
 * and the save date on Bookmarks.
 *
 * newest: (date DESC, id DESC)
 * top:    (rating DESC, date DESC, id DESC)
 */
function afterCursor(
	query: JournalQuery,
	dateCol: typeof reviews.visitedAt | typeof reviewSaves.createdAt
): SQL | undefined {
	const c = query.cursor;
	if (!c) return undefined;
	const t = new Date(c.t);
	const byDate = or(lt(dateCol, t), and(eq(dateCol, t), lt(reviews.id, c.id)));
	if (query.sort === 'newest' || c.r === undefined) return byDate;
	const r = c.r.toFixed(1);
	return or(lt(reviews.overallRating, r), and(eq(reviews.overallRating, r), byDate));
}

function orderFor(
	query: JournalQuery,
	dateCol: typeof reviews.visitedAt | typeof reviewSaves.createdAt
) {
	return query.sort === 'top'
		? [desc(reviews.overallRating), desc(dateCol), desc(reviews.id)]
		: [desc(dateCol), desc(reviews.id)];
}

/** Built from the last row of a full page; null when there is no next page. */
function nextCursorFrom(
	rows: { id: string; overallRating: string; sortDate: Date }[],
	query: JournalQuery
): JournalCursor | null {
	if (rows.length <= PAGE_SIZE) return null;
	const last = rows[PAGE_SIZE - 1]!;
	return {
		t: last.sortDate.toISOString(),
		id: last.id,
		...(query.sort === 'top' ? { r: Number(last.overallRating) } : {})
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
 * if the author makes it public again). Your own reviews are never "bookmarks".
 */
function bookmarkBase(userId: string) {
	return and(
		eq(reviewSaves.userId, userId),
		ne(reviews.userId, userId),
		eq(reviews.visibility, 'public'),
		eq(reviews.reviewStatus, 'published'),
		isNull(reviews.deletedAt),
		isNull(reviews.archivedAt),
		isNull(users.deletedAt)
	);
}

export async function getMyReviews(userId: string, query: JournalQuery): Promise<JournalPage> {
	const rows = await db
		.select({ ...spineColumns, sortDate: reviews.visitedAt })
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
		.select({ ...spineColumns, sortDate: reviewSaves.createdAt })
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
	rows: (Parameters<typeof assembleReview>[0] & { sortDate: Date })[],
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
		nextCursor: nextCursorFrom(rows, query)
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
