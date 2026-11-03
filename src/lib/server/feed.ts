/**
 * The review read path: the home feed, one review's full detail, and a person's month in
 * numbers. Separate from reviews.ts, which is the write path (publishReview and the row
 * building behind it) and has no business growing query code for the screens that read it back.
 *
 * Two shapes recur throughout:
 *
 * - **Spine then children.** One query fetches the reviews themselves (with their author and
 *   place), then a single `db.batch` fetches everything hanging off them — photos, items, tags,
 *   per-category ratings — filtered by `inArray(reviewId, ids)`. That is two round trips for N
 *   reviews instead of 1 + 4N, and it is the same batching the form lookups already use. The
 *   split matters for a second reason on the review page: it lets the caller run its visibility
 *   gate between the two, so a review the viewer may not see costs exactly one query and leaks
 *   nothing.
 *
 * - **Normalize at the edge.** Postgres hands `numeric` back as a string and timestamps as Date
 *   objects. Everything here converts both before returning, so the types in review/card.ts are
 *   JSON-plain and no component has to remember that `overallRating` might be "4.5".
 */
import { error } from '@sveltejs/kit';
import type { SQL } from 'drizzle-orm';
import {
	and,
	asc,
	count,
	desc,
	eq,
	exists,
	gte,
	inArray,
	isNull,
	lt,
	lte,
	or,
	sql
} from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import type {
	FeedCategoryRating,
	FeedItem,
	FeedPhoto,
	FeedReview,
	ReviewCardTag,
	ReviewComment,
	Visibility
} from '#lib/review/card.ts';
import type { ExploreFacet, ExploreFilters, ExploreSort } from '#lib/explore/explore.ts';
import type { MonthItemRow, MonthlyStats, MonthReviewRow } from '#lib/review/stats.ts';
import { summarizeMonth } from '#lib/review/stats.ts';
import { z } from 'zod';
import { requireUser } from './auth.ts';
import { db } from './db/index.ts';
import {
	cuisineTypes,
	drinkItemDetails,
	follows,
	drinkTypes,
	foodItemDetails,
	foodTypes,
	mediaFiles,
	places,
	ratingCategories,
	ratingCriteriaOptions,
	reviewCategoryRatings,
	reviewCommentLikes,
	reviewComments,
	reviewItemFoodTypes,
	reviewItems,
	reviewLikes,
	reviewMedia,
	reviewSaves,
	reviewRatingCriteria,
	reviews,
	users
} from './db/schema/index.ts';

/** Postgres `numeric` arrives as a string to avoid the precision loss of a float. Every value
 *  we read it for (a 1-5 rating, a price, a tax percent) is well inside a double's exact range,
 *  so converting here is safe and spares every caller the coercion. */
export function toNumber(value: string | null): number | null {
	if (value === null) return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function toIso(value: Date | null): string | null {
	return value === null ? null : value.toISOString();
}

/** Groups child rows under the review they belong to, projecting each one on the way. The
 *  projection is part of the same pass so the grouping key — which is only a join column, not
 *  something any screen displays — is dropped instead of riding along to the browser on every
 *  row. Exported for its own test: stitching is where an off-by-one in the batched-query
 *  approach would hide. */
export function groupBy<T, V>(
	rows: T[],
	key: (row: T) => string,
	project: (row: T) => V
): Map<string, V[]> {
	const grouped = new Map<string, V[]>();
	for (const row of rows) {
		const k = key(row);
		const value = project(row);
		const existing = grouped.get(k);
		if (existing) existing.push(value);
		else grouped.set(k, [value]);
	}
	return grouped;
}

/* ---------------------------------- feed pagination ---------------------------------- */

export interface FeedCursor {
	publishedAt: string;
	id: string;
}

export interface FeedPage {
	/** `isOwn`: the viewer wrote it (Explore's "Your favorite" and its hidden bookmark). */
	reviews: (FeedReview & { isOwn: boolean })[];
	/** Null on the last page. */
	nextCursor: FeedCursor | null;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** Keyset pagination state, round-tripped through the URL. Two values, not one, because
 *  published_at is not unique — two reviews published in the same millisecond would otherwise
 *  make one of them unreachable or repeat it forever. */
export function encodeCursor(cursor: FeedCursor): string {
	return `${cursor.publishedAt}_${cursor.id}`;
}

/** Returns null for anything malformed rather than throwing: this parses a URL the user can
 *  edit, and a garbled `?cursor=` should quietly show page one, not a 500. */
export function decodeCursor(raw: string | null): FeedCursor | null {
	if (!raw) return null;
	const separator = raw.lastIndexOf('_');
	if (separator <= 0) return null;

	const publishedAt = raw.slice(0, separator);
	const id = raw.slice(separator + 1);
	// The id is compared against a uuid column, so a non-uuid would reach Postgres as-is and 500.
	if (!z.uuid().safeParse(id).success || Number.isNaN(new Date(publishedAt).getTime())) return null;

	return { publishedAt, id };
}

/* ------------------------------------- queries --------------------------------------- */

/** A review joined to its author and place, with nothing hanging off it yet: one row of every
 *  list here, and of the review page. */
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

/** One review joined to its author and place, with nothing hanging off it yet. Carries the raw
 *  gate columns (visibility, reviewStatus, deletedAt, userId) so the caller can decide whether
 *  this viewer may see it before paying for the children. */
export async function getReviewSpine(reviewId: string) {
	const [row] = await db
		.select(spineColumns)
		.from(reviews)
		.innerJoin(users, eq(reviews.userId, users.id))
		.innerJoin(places, eq(reviews.placeId, places.id))
		.where(eq(reviews.id, reviewId))
		.limit(1);

	return row ?? null;
}

export type SpineRow = NonNullable<Awaited<ReturnType<typeof getReviewSpine>>>;

/**
 * Whether `viewerId` (null when signed out) may see — and so interact with — this review. Public
 * and published is visible to everyone; anything else (a draft, hidden or removed by moderation,
 * soft-deleted, archived by its author, or friends/private) only to its own author. The caller turns a `false` into a
 * 404, the same response as "no such review", so a guessed id can't tell "private" from
 * "doesn't exist". 'friends' still behaves like 'private' until follows exist.
 *
 * One definition, used by the review page and by every write against a review (like, comment),
 * so a private review can never be liked or commented on by someone who guessed its id.
 */
export function canViewReview(
	row: Pick<SpineRow, 'visibility' | 'reviewStatus' | 'deletedAt' | 'archivedAt' | 'userId'>,
	viewerId: string | null
): boolean {
	// An archived review is the author's alone again, like a private one.
	const isPublic =
		row.visibility === 'public' &&
		row.reviewStatus === 'published' &&
		row.deletedAt === null &&
		row.archivedAt === null;
	return isPublic || (viewerId !== null && viewerId === row.userId);
}

/** The gate every write against a review repeats: a signed-in user, a valid id, and a review that
 *  exists and that user may see. Auth comes first so a signed-out caller gets 401 whatever the id
 *  is. Anything else is a 404, never a 403, so a guessed id can't reveal a private review. */
export async function requireVisibleReview(locals: App.Locals, reviewId: string) {
	const user = await requireUser(locals);
	if (!z.uuid().safeParse(reviewId).success) error(404, 'Review not found');
	const row = await getReviewSpine(reviewId);
	if (!row || !canViewReview(row, user.id)) error(404, 'Review not found');
	return { user, row };
}

export interface Children {
	photos: Map<string, FeedPhoto[]>;
	items: Map<string, FeedItem[]>;
	tags: Map<string, ReviewCardTag[]>;
	categoryRatings: Map<string, FeedCategoryRating[]>;
	likeCounts: Map<string, number>;
	commentCounts: Map<string, number>;
	/** Review ids the viewer has liked; empty when signed out. */
	likedByViewer: Set<string>;
	/** Review ids the viewer has saved; empty when signed out. */
	savedByViewer: Set<string>;
	/** Review ids whose author the viewer follows; empty when signed out. */
	authorFollowedByViewer: Set<string>;
}

// No real row ever has this id (the nil UUID; `defaultRandom()` draws from v4, which can't
// produce it) — a stand-in for "nobody" so a signed-out viewer's engagement lookups stay real
// queries with a guaranteed-empty result, rather than a branch that changes how many queries
// are in the batch below. The DB does a few microseconds of pointless index work instead of
// the query being skipped; what it buys back is one network round trip instead of two.
export const NOBODY_ID = '00000000-0000-0000-0000-000000000000';

/** The shape likes and saves share: one row per (review, user). */
function viewerRowIds(
	table: PgTable,
	reviewIdCol: AnyPgColumn<{ data: string; notNull: true }>,
	userIdCol: AnyPgColumn,
	{ viewerId, reviewIds }: { viewerId: string | null; reviewIds: string[] }
) {
	return db
		.select({ reviewId: reviewIdCol })
		.from(table)
		.where(and(eq(userIdCol, viewerId ?? NOBODY_ID), inArray(reviewIdCol, reviewIds)));
}

/**
 * Everything that hangs off a set of reviews, in one batch — ten queries, one round trip,
 * regardless of how many reviews are in `reviewIds`.
 *
 * The feed only strictly needs photos, items and tags; the per-category ratings are the review
 * page's rating panel. They are fetched either way rather than behind a flag: it is a handful
 * of extra rows inside a batch that was already going out, and one code path means the feed
 * card and the review page can never disagree about what a review contains. The same is true
 * of the viewer's own likes and saves (last two queries): always fetched, never a second trip.
 */
export async function getReviewChildren(
	reviewIds: string[],
	viewerId: string | null = null
): Promise<Children> {
	if (reviewIds.length === 0) {
		return {
			photos: new Map(),
			items: new Map(),
			tags: new Map(),
			categoryRatings: new Map(),
			likeCounts: new Map(),
			commentCounts: new Map(),
			likedByViewer: new Set(),
			savedByViewer: new Set(),
			authorFollowedByViewer: new Set()
		};
	}

	const [
		photoRows,
		itemRows,
		foodTypeRows,
		tagRows,
		ratingRows,
		likeCountRows,
		commentCountRows,
		likedRows,
		savedRows,
		followedRows
	] = await db.batch([
		// A media row can be soft-deleted by the orphan cleanup job (photoCleanup.ts) after the
		// review is published, so filter on the file's own status rather than trusting the join.
		db
			.select({
				reviewId: reviewMedia.reviewId,
				url: mediaFiles.url,
				width: mediaFiles.width,
				height: mediaFiles.height,
				caption: reviewMedia.caption
			})
			.from(reviewMedia)
			.innerJoin(mediaFiles, eq(reviewMedia.mediaId, mediaFiles.id))
			.where(
				and(
					inArray(reviewMedia.reviewId, reviewIds),
					eq(mediaFiles.mediaStatus, 'active'),
					isNull(mediaFiles.deletedAt)
				)
			)
			// The cover leads the gallery wherever it is rendered, so order it first here and no
			// consumer has to re-sort.
			.orderBy(desc(reviewMedia.isCover), asc(reviewMedia.displayOrder)),

		db
			.select({
				id: reviewItems.id,
				reviewId: reviewItems.reviewId,
				itemType: reviewItems.itemType,
				itemName: reviewItems.itemName,
				price: reviewItems.price,
				taxPercent: reviewItems.taxPercent,
				portionSize: foodItemDetails.portionSize,
				cuisineName: cuisineTypes.name,
				sizeLabel: drinkItemDetails.sizeLabel,
				sugarLevelPercent: drinkItemDetails.sugarLevelPercent,
				iceLevel: drinkItemDetails.iceLevel,
				drinkTypeName: drinkTypes.name
			})
			.from(reviewItems)
			.leftJoin(foodItemDetails, eq(foodItemDetails.reviewItemId, reviewItems.id))
			.leftJoin(cuisineTypes, eq(foodItemDetails.cuisineTypeId, cuisineTypes.id))
			.leftJoin(drinkItemDetails, eq(drinkItemDetails.reviewItemId, reviewItems.id))
			.leftJoin(drinkTypes, eq(drinkItemDetails.drinkTypeId, drinkTypes.id))
			.where(inArray(reviewItems.reviewId, reviewIds))
			.orderBy(asc(reviewItems.displayOrder)),

		// Food types are many-per-item, so they can't ride the item query without multiplying
		// its rows. The card and review page only show the first, but fetching the set keeps
		// that a display decision rather than one baked into SQL.
		db
			.select({
				reviewItemId: reviewItemFoodTypes.reviewItemId,
				name: foodTypes.name
			})
			.from(reviewItemFoodTypes)
			.innerJoin(reviewItems, eq(reviewItemFoodTypes.reviewItemId, reviewItems.id))
			.innerJoin(foodTypes, eq(reviewItemFoodTypes.foodTypeId, foodTypes.id))
			.where(inArray(reviewItems.reviewId, reviewIds)),

		db
			.select({
				reviewId: reviewCategoryRatings.reviewId,
				label: ratingCriteriaOptions.label,
				sentiment: ratingCriteriaOptions.sentiment
			})
			.from(reviewCategoryRatings)
			.innerJoin(
				reviewRatingCriteria,
				eq(reviewRatingCriteria.reviewCategoryRatingId, reviewCategoryRatings.id)
			)
			.innerJoin(
				ratingCriteriaOptions,
				eq(reviewRatingCriteria.criteriaOptionId, ratingCriteriaOptions.id)
			)
			.where(inArray(reviewCategoryRatings.reviewId, reviewIds)),

		db
			.select({
				reviewId: reviewCategoryRatings.reviewId,
				categoryId: ratingCategories.id,
				slug: ratingCategories.slug,
				name: ratingCategories.name,
				ratingValue: reviewCategoryRatings.ratingValue
			})
			.from(reviewCategoryRatings)
			.innerJoin(ratingCategories, eq(reviewCategoryRatings.ratingCategoryId, ratingCategories.id))
			.where(inArray(reviewCategoryRatings.reviewId, reviewIds))
			.orderBy(asc(ratingCategories.displayOrder)),

		db
			.select({ reviewId: reviewLikes.reviewId, n: count() })
			.from(reviewLikes)
			.where(inArray(reviewLikes.reviewId, reviewIds))
			.groupBy(reviewLikes.reviewId),

		// Joined to users like getComments, so the count matches the list it sits above.
		db
			.select({ reviewId: reviewComments.reviewId, n: count() })
			.from(reviewComments)
			.innerJoin(users, eq(reviewComments.userId, users.id))
			.where(
				and(
					inArray(reviewComments.reviewId, reviewIds),
					isNull(reviewComments.deletedAt),
					isNull(users.deletedAt)
				)
			)
			.groupBy(reviewComments.reviewId),

		// The viewer's own likes and saves depend on who is looking; they ride in the same
		// batch as everything above (one round trip for all ten queries) rather than a
		// separate await — `viewerRowIds` keeps that correct for a signed-out viewer too.
		viewerRowIds(reviewLikes, reviewLikes.reviewId, reviewLikes.userId, {
			viewerId,
			reviewIds
		}),
		viewerRowIds(reviewSaves, reviewSaves.reviewId, reviewSaves.userId, {
			viewerId,
			reviewIds
		}),

		// Keyed by review rather than author so it stitches like the rest: the reviews in this
		// batch whose author the viewer follows.
		db
			.select({ reviewId: reviews.id })
			.from(reviews)
			.innerJoin(follows, eq(follows.followeeId, reviews.userId))
			.where(and(eq(follows.followerId, viewerId ?? NOBODY_ID), inArray(reviews.id, reviewIds)))
	]);

	const foodTypeByItem = groupBy(
		foodTypeRows,
		(r) => r.reviewItemId,
		(r) => r.name
	);

	return {
		photos: groupBy(
			photoRows,
			(r) => r.reviewId,
			(r) => ({ url: r.url, caption: r.caption, width: r.width, height: r.height })
		),
		items: groupBy(
			itemRows,
			(r) => r.reviewId,
			(r) => ({
				id: r.id,
				itemType: r.itemType === 'drink' ? ('drink' as const) : ('food' as const),
				itemName: r.itemName,
				price: toNumber(r.price),
				taxPercent: toNumber(r.taxPercent),
				typeLabel:
					r.itemType === 'drink' ? r.drinkTypeName : (foodTypeByItem.get(r.id)?.[0] ?? null),
				cuisineLabel: r.cuisineName,
				portionSize: r.portionSize,
				sizeLabel: r.sizeLabel,
				sugarLevelPercent: r.sugarLevelPercent,
				iceLevel: r.iceLevel
			})
		),
		// 'neutral' is a valid sentiment in the database but the UI has no third color for it,
		// and nestCriteria drops it from the form for the same reason — so it can't be chosen,
		// and anything historical is left out here rather than mislabelled as praise.
		tags: groupBy(
			tagRows.filter((r) => r.sentiment === 'positive' || r.sentiment === 'negative'),
			(r) => r.reviewId,
			(r) => ({ label: r.label, sentiment: r.sentiment as 'positive' | 'negative' })
		),
		categoryRatings: groupBy(
			ratingRows,
			(r) => r.reviewId,
			(r) => ({
				categoryId: r.categoryId,
				slug: r.slug,
				name: r.name,
				ratingValue: toNumber(r.ratingValue)
			})
		),
		likeCounts: new Map(likeCountRows.map((r) => [r.reviewId, r.n])),
		commentCounts: new Map(commentCountRows.map((r) => [r.reviewId, r.n])),
		likedByViewer: new Set(likedRows.map((r) => r.reviewId)),
		savedByViewer: new Set(savedRows.map((r) => r.reviewId)),
		authorFollowedByViewer: new Set(followedRows.map((r) => r.reviewId))
	};
}

/** Stitches a spine row and its children into the shape the card and review page consume. */
export function assembleReview(row: SpineRow, children: Children): FeedReview {
	return {
		id: row.id,
		author: {
			displayName: row.authorDisplayName,
			avatarUrl: row.authorAvatarUrl
		},
		place: {
			id: row.placeId,
			name: row.placeName,
			addressLine1: row.placeAddressLine1,
			city: row.placeCity
		},
		reviewType: row.reviewType,
		visitType: row.visitType,
		mealType: row.mealType,
		// notNull in the schema, so the `?? ''` is unreachable — it exists only because the
		// column type is Date and toIso's signature admits null.
		visitedAt: toIso(row.visitedAt) ?? '',
		publishedAt: toIso(row.publishedAt),
		overallRating: toNumber(row.overallRating) ?? 0,
		title: row.title,
		description: row.description,
		visibility: row.visibility as Visibility,
		isFavorite: row.isFavorite,
		photos: children.photos.get(row.id) ?? [],
		items: children.items.get(row.id) ?? [],
		tags: children.tags.get(row.id) ?? [],
		categoryRatings: children.categoryRatings.get(row.id) ?? [],
		likeCount: children.likeCounts.get(row.id) ?? 0,
		commentCount: children.commentCounts.get(row.id) ?? 0,
		viewerHasLiked: children.likedByViewer.has(row.id),
		viewerHasSaved: children.savedByViewer.has(row.id),
		viewerFollowsAuthor: children.authorFollowedByViewer.has(row.id)
	};
}

/** Published, public, live, by a live author: what anyone may see in a list. A soft-deleted
 *  author's reviews drop out with them, rather than showing a card for someone who no longer
 *  exists. Needs `users` joined. */
export const listedReview = and(
	eq(reviews.visibility, 'public'),
	eq(reviews.reviewStatus, 'published'),
	isNull(reviews.deletedAt),
	isNull(reviews.archivedAt),
	isNull(users.deletedAt)
	// blocks: exclude authors the viewer blocked (and who blocked them) here, once blocks exist.
);

function feedLimit(limit: number | undefined): number {
	return Math.min(Math.max(1, Math.trunc(limit ?? DEFAULT_LIMIT)), MAX_LIMIT);
}

function olderThan(cursor: FeedCursor | null): SQL | undefined {
	return cursor
		? or(
				lt(reviews.publishedAt, new Date(cursor.publishedAt)),
				and(eq(reviews.publishedAt, new Date(cursor.publishedAt)), lt(reviews.id, cursor.id))
			)
		: undefined;
}

/** Spine rows to the page shape: children in one batch, `isOwn` against the viewer. */
async function toFeedReviews(
	rows: SpineRow[],
	viewerId: string | null
): Promise<FeedPage['reviews']> {
	const children = await getReviewChildren(
		rows.map((r) => r.id),
		viewerId
	);
	return rows.map((row) => ({
		...assembleReview(row, children),
		isOwn: viewerId !== null && row.userId === viewerId
	}));
}

/**
 * The public feed, newest first.
 *
 * Keyset pagination rather than OFFSET: a feed people publish into while someone is reading it
 * shifts under an offset, which duplicates and skips rows, and OFFSET also has to walk the rows
 * it discards. The `(published_at, id) < (cursor)` comparison rides
 * `idx_reviews_visibility (visibility, published_at DESC)`.
 *
 * Note that index is not partial on review_status / deleted_at, so Postgres applies those two
 * as a filter on top of the index scan rather than skipping them outright. That is the right
 * trade at this size, and narrowing the index is a migration this milestone doesn't make.
 */
export async function getForYouFeed(
	opts: { limit?: number; cursor?: FeedCursor | null; viewerId?: string | null } = {}
): Promise<FeedPage> {
	const limit = feedLimit(opts.limit);

	const spine = await db
		.select(spineColumns)
		.from(reviews)
		.innerJoin(users, eq(reviews.userId, users.id))
		.innerJoin(places, eq(reviews.placeId, places.id))
		.where(and(listedReview, olderThan(opts.cursor ?? null)))
		.orderBy(desc(reviews.publishedAt), desc(reviews.id))
		// One more than asked for: if it comes back, there is a next page. Cheaper than a
		// separate count(*) over the whole table for a question that only needs a yes/no.
		.limit(limit + 1);

	const page = spine.slice(0, limit);
	const last = page.at(-1);
	return {
		reviews: await toFeedReviews(page, opts.viewerId ?? null),
		nextCursor:
			spine.length > limit && last?.publishedAt
				? { publishedAt: last.publishedAt.toISOString(), id: last.id }
				: null
	};
}

/* -------------------------------------- Explore -------------------------------------- */

export interface ExplorePage {
	reviews: FeedPage['reviews'];
	/** Already encoded for the URL; null on the last page. */
	nextCursor: string | null;
	/** Every review the filters match, for the panel's "Show 12 reviews". */
	matchCount: number;
	facets: { cuisines: ExploreFacet[]; kinds: ExploreFacet[] };
}

/** Explore's page token. Newest first pages by keyset, as Home does. Top rated and Most liked
 *  page by offset (`o:40`): a keyset over (rating or likes, published_at, id) would work, but
 *  these orders barely shift while you read, and the offset is one number instead of four. */
function parseExploreCursor(
	raw: string | null,
	sort: ExploreSort
): { keyset: FeedCursor | null; offset: number } {
	if (sort === 'new') return { keyset: decodeCursor(raw), offset: 0 };
	const match = raw?.match(/^o:(\d{1,6})$/);
	return { keyset: null, offset: match ? Number(match[1]) : 0 };
}

const likeCountOf = sql<number>`(select count(*)::int from ${reviewLikes} where ${reviewLikes.reviewId} = ${reviews.id})`;

/**
 * Explore's grid: every listed review, narrowed by the filters (as SQL, before the LIMIT, so
 * paging stays correct) and in the chosen order. Its count and the panel's facet lists ride in
 * the same batch as the spine, so a page is two round trips: that batch, then the children.
 */
export async function getExploreFeed(opts: {
	filters: ExploreFilters;
	cursor: string | null;
	viewerId: string | null;
	limit?: number;
	/** Narrows to food matching a search (already normalized); see explore-search.ts. */
	search?: SQL;
}): Promise<ExplorePage> {
	const { filters, viewerId } = opts;
	const limit = feedLimit(opts.limit);
	const { keyset, offset } = parseExploreCursor(opts.cursor, filters.sort);
	const matches = and(listedReview, exploreFilterWhere(filters, viewerId), opts.search);

	const order =
		filters.sort === 'top'
			? [
					desc(reviews.overallRating),
					desc(likeCountOf),
					desc(reviews.publishedAt),
					desc(reviews.id)
				]
			: filters.sort === 'liked'
				? [desc(likeCountOf), desc(reviews.publishedAt), desc(reviews.id)]
				: [desc(reviews.publishedAt), desc(reviews.id)];

	// Facets count distinct listed reviews per type; a review naming a type on two items counts once.
	const reviewsUsing = sql<number>`count(distinct ${reviews.id})::int`;

	const [spine, [total], cuisineRows, foodKindRows, drinkKindRows] = await db.batch([
		db
			.select(spineColumns)
			.from(reviews)
			.innerJoin(users, eq(reviews.userId, users.id))
			.innerJoin(places, eq(reviews.placeId, places.id))
			.where(and(matches, olderThan(keyset)))
			.orderBy(...order)
			.limit(limit + 1)
			.offset(offset),

		// Joins places like the spine, so a search on the place name counts the same rows.
		db
			.select({ n: count() })
			.from(reviews)
			.innerJoin(users, eq(reviews.userId, users.id))
			.innerJoin(places, eq(reviews.placeId, places.id))
			.where(matches),

		db
			.select({ slug: cuisineTypes.slug, name: cuisineTypes.name, count: reviewsUsing })
			.from(reviews)
			.innerJoin(users, eq(reviews.userId, users.id))
			.innerJoin(reviewItems, eq(reviewItems.reviewId, reviews.id))
			.innerJoin(foodItemDetails, eq(foodItemDetails.reviewItemId, reviewItems.id))
			.innerJoin(cuisineTypes, eq(cuisineTypes.id, foodItemDetails.cuisineTypeId))
			.where(listedReview)
			.groupBy(cuisineTypes.slug, cuisineTypes.name),

		db
			.select({ slug: foodTypes.slug, name: foodTypes.name, count: reviewsUsing })
			.from(reviews)
			.innerJoin(users, eq(reviews.userId, users.id))
			.innerJoin(reviewItems, eq(reviewItems.reviewId, reviews.id))
			.innerJoin(reviewItemFoodTypes, eq(reviewItemFoodTypes.reviewItemId, reviewItems.id))
			.innerJoin(foodTypes, eq(foodTypes.id, reviewItemFoodTypes.foodTypeId))
			.where(listedReview)
			.groupBy(foodTypes.slug, foodTypes.name),

		db
			.select({ slug: drinkTypes.slug, name: drinkTypes.name, count: reviewsUsing })
			.from(reviews)
			.innerJoin(users, eq(reviews.userId, users.id))
			.innerJoin(reviewItems, eq(reviewItems.reviewId, reviews.id))
			.innerJoin(drinkItemDetails, eq(drinkItemDetails.reviewItemId, reviewItems.id))
			.innerJoin(drinkTypes, eq(drinkTypes.id, drinkItemDetails.drinkTypeId))
			.where(listedReview)
			.groupBy(drinkTypes.slug, drinkTypes.name)
	]);

	const page = spine.slice(0, limit);
	const last = page.at(-1);
	let nextCursor: string | null = null;
	if (spine.length > limit && last) {
		nextCursor =
			filters.sort === 'new'
				? last.publishedAt &&
					encodeCursor({ publishedAt: last.publishedAt.toISOString(), id: last.id })
				: `o:${offset + limit}`;
	}

	return {
		reviews: await toFeedReviews(page, viewerId),
		nextCursor: nextCursor || null,
		matchCount: total?.n ?? 0,
		facets: {
			cuisines: byUse(cuisineRows),
			kinds: byUse([...foodKindRows, ...drinkKindRows])
		}
	};
}

/** Most used first, then by name. A food type and a drink type sharing a slug (the filter matches
 *  both anyway) are merged into one choice. */
function byUse(rows: ExploreFacet[]): ExploreFacet[] {
	const bySlug = new Map<string, ExploreFacet>();
	for (const row of rows) {
		const seen = bySlug.get(row.slug);
		bySlug.set(row.slug, seen ? { ...seen, count: seen.count + row.count } : { ...row });
	}
	return [...bySlug.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Explore's filters as SQL: OR inside a section, AND across sections, an empty section adds
 *  nothing. A review covering a dish and a drink matches if either item does. Types are matched
 *  by slug, not display name, so renaming one in the lookup table doesn't silently empty a chip. */
function exploreFilterWhere(f: ExploreFilters, viewerId: string | null): SQL | undefined {
	const itemOfThisReview = eq(reviewItems.reviewId, reviews.id);
	const anyItem = (where: SQL | undefined) =>
		exists(
			db
				.select({ one: sql`1` })
				.from(reviewItems)
				.where(and(itemOfThisReview, where))
		);

	return and(
		f.meals.length ? inArray(reviews.mealType, f.meals) : undefined,
		f.type === 'any' ? undefined : anyItem(eq(reviewItems.itemType, f.type)),
		f.cuisines.length
			? exists(
					db
						.select({ one: sql`1` })
						.from(reviewItems)
						.innerJoin(foodItemDetails, eq(foodItemDetails.reviewItemId, reviewItems.id))
						.innerJoin(cuisineTypes, eq(cuisineTypes.id, foodItemDetails.cuisineTypeId))
						.where(and(itemOfThisReview, inArray(cuisineTypes.slug, f.cuisines)))
				)
			: undefined,
		f.kinds.length
			? or(
					exists(
						db
							.select({ one: sql`1` })
							.from(reviewItems)
							.innerJoin(reviewItemFoodTypes, eq(reviewItemFoodTypes.reviewItemId, reviewItems.id))
							.innerJoin(foodTypes, eq(foodTypes.id, reviewItemFoodTypes.foodTypeId))
							.where(and(itemOfThisReview, inArray(foodTypes.slug, f.kinds)))
					),
					exists(
						db
							.select({ one: sql`1` })
							.from(reviewItems)
							.innerJoin(drinkItemDetails, eq(drinkItemDetails.reviewItemId, reviewItems.id))
							.innerJoin(drinkTypes, eq(drinkTypes.id, drinkItemDetails.drinkTypeId))
							.where(and(itemOfThisReview, inArray(drinkTypes.slug, f.kinds)))
					)
				)
			: undefined,
		// The price on the card is the items' total before tax; a review with no prices at all
		// sums to null and so never matches a price cap.
		f.maxPrice
			? sql`(select sum(${reviewItems.price}) from ${reviewItems} where ${itemOfThisReview}) <= ${f.maxPrice}`
			: undefined,
		f.rating ? gte(reviews.overallRating, String(f.rating)) : undefined,
		// Signed out follows nobody, so "People I follow" is empty rather than everything.
		f.from === 'following'
			? exists(
					db
						.select({ one: sql`1` })
						.from(follows)
						.where(
							and(
								eq(follows.followerId, viewerId ?? NOBODY_ID),
								eq(follows.followeeId, reviews.userId)
							)
						)
				)
			: undefined,
		f.photos
			? exists(
					db
						.select({ one: sql`1` })
						.from(reviewMedia)
						.innerJoin(mediaFiles, eq(reviewMedia.mediaId, mediaFiles.id))
						.where(
							and(
								eq(reviewMedia.reviewId, reviews.id),
								eq(mediaFiles.mediaStatus, 'active'),
								isNull(mediaFiles.deletedAt)
							)
						)
				)
			: undefined
	);
}

/* ------------------------------------- place page ------------------------------------- */

export interface PlacePage {
	place: {
		id: string;
		name: string;
		address: string | null;
		/** For Directions; null if the stored point can't be read. */
		lat: number | null;
		lng: number | null;
	};
	/** Every listed review here, newest first. */
	reviews: FeedPage['reviews'];
}

/** A place has a handful of reviews, so they all come at once and the page filters and sorts
 *  them on the client. Capped anyway, so a very popular place can't make one huge response. */
const PLACE_REVIEW_LIMIT = 200;

/** A place and its public reviews, or null for no such (live) place. */
export async function getPlacePage(
	placeId: string,
	viewerId: string | null
): Promise<PlacePage | null> {
	const [[place], spine] = await db.batch([
		db
			.select({
				id: places.id,
				name: places.name,
				address: sql<
					string | null
				>`nullif(concat_ws(', ', ${places.addressLine1}, ${places.city}), '')`,
				lat: sql<number | null>`st_y(${places.location}::geometry)`,
				lng: sql<number | null>`st_x(${places.location}::geometry)`
			})
			.from(places)
			.where(and(eq(places.id, placeId), isNull(places.deletedAt)))
			.limit(1),

		db
			.select(spineColumns)
			.from(reviews)
			.innerJoin(users, eq(reviews.userId, users.id))
			.innerJoin(places, eq(reviews.placeId, places.id))
			.where(and(listedReview, eq(reviews.placeId, placeId)))
			.orderBy(desc(reviews.publishedAt), desc(reviews.id))
			.limit(PLACE_REVIEW_LIMIT)
	]);

	if (!place) return null;
	return { place, reviews: await toFeedReviews(spine, viewerId) };
}

/** A review's comments: top-level threads first (pinned, then newest), then their replies newest
 *  first. The author join also drops comments by a since-deleted user, for the same reason the
 *  feed drops their reviews. Paged by thread, not by row: at most 200 top-level comments, with
 *  every reply to those, so a reply is never orphaned and a pinned comment never falls outside
 *  the window. There is no paging UI yet, and an unbounded list on a popular review is the one
 *  way this page could get slow. */
export async function getComments(
	reviewId: string,
	viewerId: string | null
): Promise<ReviewComment[]> {
	const select = (scope: SQL | undefined) =>
		db
			.select({
				id: reviewComments.id,
				userId: reviewComments.userId,
				parentId: reviewComments.parentId,
				pinnedAt: reviewComments.pinnedAt,
				photoUrl: mediaFiles.url,
				photoWidth: mediaFiles.width,
				photoHeight: mediaFiles.height,
				body: reviewComments.body,
				createdAt: reviewComments.createdAt,
				editedAt: reviewComments.editedAt,
				// Correlated subqueries keep this one round trip; each rides the likes table's PK,
				// whose leading column is the comment id.
				likeCount: sql<number>`(select count(*)::int from ${reviewCommentLikes} where ${reviewCommentLikes.commentId} = ${reviewComments.id})`,
				viewerHasLiked: viewerId
					? sql<boolean>`exists (select 1 from ${reviewCommentLikes} where ${reviewCommentLikes.commentId} = ${reviewComments.id} and ${reviewCommentLikes.userId} = ${viewerId})`
					: sql<boolean>`false`,
				authorDisplayName: users.displayName,
				authorAvatarUrl: users.avatarUrl
			})
			.from(reviewComments)
			.innerJoin(users, eq(reviewComments.userId, users.id))
			// Same status filter as review photos: a file the cleanup job has claimed isn't shown.
			.leftJoin(
				mediaFiles,
				and(
					eq(reviewComments.mediaId, mediaFiles.id),
					eq(mediaFiles.mediaStatus, 'active'),
					isNull(mediaFiles.deletedAt)
				)
			)
			.where(
				and(
					eq(reviewComments.reviewId, reviewId),
					isNull(reviewComments.deletedAt),
					isNull(users.deletedAt),
					scope
				)
			);

	const threads = await select(isNull(reviewComments.parentId))
		.orderBy(
			desc(sql`${reviewComments.pinnedAt} is not null`),
			desc(reviewComments.createdAt),
			desc(reviewComments.id)
		)
		.limit(200);
	const replies = threads.length
		? await select(
				inArray(
					reviewComments.parentId,
					threads.map((t) => t.id)
				)
			).orderBy(desc(reviewComments.createdAt), desc(reviewComments.id))
		: [];
	const rows = [...threads, ...replies];

	return rows.map((r) => ({
		id: r.id,
		body: r.body,
		createdAt: r.createdAt.toISOString(),
		author: { displayName: r.authorDisplayName, avatarUrl: r.authorAvatarUrl },
		parentId: r.parentId,
		pinned: r.pinnedAt !== null,
		photo: r.photoUrl ? { url: r.photoUrl, width: r.photoWidth, height: r.photoHeight } : null,
		isOwn: viewerId !== null && r.userId === viewerId,
		editedAt: r.editedAt?.toISOString() ?? null,
		likeCount: r.likeCount,
		viewerHasLiked: r.viewerHasLiked
	}));
}

/* -------------------------------------- stats ---------------------------------------- */

/** The viewer's own published reviews in a calendar month, summarized for the home sidebar.
 *  Rides `idx_reviews_user_published`. Two small selects in one batch; the arithmetic and the
 *  "what counts as a habit" judgement live in review/stats.ts, where they are testable. */
export async function getMonthlyStats(
	userId: string,
	monthStart: Date,
	monthEnd: Date
): Promise<MonthlyStats> {
	const inMonth = and(
		eq(reviews.userId, userId),
		eq(reviews.reviewStatus, 'published'),
		isNull(reviews.deletedAt),
		isNull(reviews.archivedAt),
		gte(reviews.publishedAt, monthStart),
		lte(reviews.publishedAt, monthEnd)
	);

	const [reviewRows, itemRows] = await db.batch([
		db
			.select({
				overallRating: reviews.overallRating,
				visitType: reviews.visitType,
				mealType: reviews.mealType
			})
			.from(reviews)
			.where(inMonth),
		db
			.select({ price: reviewItems.price, taxPercent: reviewItems.taxPercent })
			.from(reviewItems)
			.innerJoin(reviews, eq(reviewItems.reviewId, reviews.id))
			.where(inMonth)
	]);

	const monthReviews: MonthReviewRow[] = reviewRows.map((r) => ({
		overallRating: toNumber(r.overallRating) ?? 0,
		visitType: r.visitType,
		mealType: r.mealType
	}));
	const monthItems: MonthItemRow[] = itemRows.map((r) => ({
		price: toNumber(r.price),
		taxPercent: toNumber(r.taxPercent)
	}));

	return summarizeMonth(monthReviews, monthItems);
}
