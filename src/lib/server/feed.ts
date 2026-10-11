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
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, or } from 'drizzle-orm';
import type {
	FeedCategoryRating,
	FeedItem,
	FeedPhoto,
	FeedReview,
	ReviewCardTag,
	Visibility
} from '#lib/review/card.ts';
import type { MonthItemRow, MonthlyStats, MonthReviewRow } from '#lib/review/stats.ts';
import { summarizeMonth } from '#lib/review/stats.ts';
import { db } from './db/index.ts';
import {
	cuisineTypes,
	drinkItemDetails,
	drinkTypes,
	foodItemDetails,
	foodTypes,
	mediaFiles,
	places,
	ratingCategories,
	ratingCriteriaOptions,
	reviewCategoryRatings,
	reviewItemFoodTypes,
	reviewItems,
	reviewMedia,
	reviewRatingCriteria,
	reviews,
	users
} from './db/schema/index.ts';

/** Postgres `numeric` arrives as a string to avoid the precision loss of a float. Every value
 *  we read it for (a 1-5 rating, a price, a tax percent) is well inside a double's exact range,
 *  so converting here is safe and spares every caller the coercion. */
function toNumber(value: string | null): number | null {
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
	reviews: FeedReview[];
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
	if (!id || Number.isNaN(new Date(publishedAt).getTime())) return null;

	return { publishedAt, id };
}

/* ------------------------------------- queries --------------------------------------- */

/** One review joined to its author and place, with nothing hanging off it yet. Carries the raw
 *  gate columns (visibility, reviewStatus, deletedAt, userId) so the caller can decide whether
 *  this viewer may see it before paying for the children. */
export async function getReviewSpine(reviewId: string) {
	const [row] = await db
		.select({
			id: reviews.id,
			userId: reviews.userId,
			visibility: reviews.visibility,
			reviewStatus: reviews.reviewStatus,
			deletedAt: reviews.deletedAt,
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
		})
		.from(reviews)
		.innerJoin(users, eq(reviews.userId, users.id))
		.innerJoin(places, eq(reviews.placeId, places.id))
		.where(eq(reviews.id, reviewId))
		.limit(1);

	return row ?? null;
}

type SpineRow = NonNullable<Awaited<ReturnType<typeof getReviewSpine>>>;

interface Children {
	photos: Map<string, FeedPhoto[]>;
	items: Map<string, FeedItem[]>;
	tags: Map<string, ReviewCardTag[]>;
	categoryRatings: Map<string, FeedCategoryRating[]>;
}

/**
 * Everything that hangs off a set of reviews, in one batch — four queries, one round trip,
 * regardless of how many reviews are in `reviewIds`.
 *
 * The feed only strictly needs photos, items and tags; the per-category ratings are the review
 * page's rating panel. They are fetched either way rather than behind a flag: it is a handful
 * of extra rows inside a batch that was already going out, and one code path means the feed
 * card and the review page can never disagree about what a review contains.
 */
export async function getReviewChildren(reviewIds: string[]): Promise<Children> {
	if (reviewIds.length === 0) {
		return { photos: new Map(), items: new Map(), tags: new Map(), categoryRatings: new Map() };
	}

	const [photoRows, itemRows, foodTypeRows, tagRows, ratingRows] = await db.batch([
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
			.orderBy(asc(ratingCategories.displayOrder))
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
		)
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
		categoryRatings: children.categoryRatings.get(row.id) ?? []
	};
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
	opts: { limit?: number; cursor?: FeedCursor | null } = {}
): Promise<FeedPage> {
	const limit = Math.min(Math.max(1, Math.trunc(opts.limit ?? DEFAULT_LIMIT)), MAX_LIMIT);
	const cursor = opts.cursor ?? null;

	const published = and(
		eq(reviews.visibility, 'public'),
		eq(reviews.reviewStatus, 'published'),
		isNull(reviews.deletedAt),
		// A soft-deleted author's reviews drop out of the feed with them, rather than showing a
		// card for someone who no longer exists.
		isNull(users.deletedAt)
	);

	const olderThanCursor = cursor
		? or(
				lt(reviews.publishedAt, new Date(cursor.publishedAt)),
				and(eq(reviews.publishedAt, new Date(cursor.publishedAt)), lt(reviews.id, cursor.id))
			)
		: undefined;

	const spine = await db
		.select({
			id: reviews.id,
			userId: reviews.userId,
			visibility: reviews.visibility,
			reviewStatus: reviews.reviewStatus,
			deletedAt: reviews.deletedAt,
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
		})
		.from(reviews)
		.innerJoin(users, eq(reviews.userId, users.id))
		.innerJoin(places, eq(reviews.placeId, places.id))
		.where(olderThanCursor ? and(published, olderThanCursor) : published)
		.orderBy(desc(reviews.publishedAt), desc(reviews.id))
		// One more than asked for: if it comes back, there is a next page. Cheaper than a
		// separate count(*) over the whole table for a question that only needs a yes/no.
		.limit(limit + 1);

	const page = spine.slice(0, limit);
	const children = await getReviewChildren(page.map((r) => r.id));

	const last = page.at(-1);
	const nextCursor =
		spine.length > limit && last?.publishedAt
			? { publishedAt: last.publishedAt.toISOString(), id: last.id }
			: null;

	return { reviews: page.map((row) => assembleReview(row, children)), nextCursor };
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
