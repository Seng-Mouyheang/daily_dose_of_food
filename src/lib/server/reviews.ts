import { createHash } from 'node:crypto';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { CategoryRatingInput, PublishReview, ReviewItemInput } from '../review/schema.ts';
import { cloudinarySignatureValid, deliveryUrl, publicIdBelongsToUser } from './cloudinary.ts';
import { db } from './db/index.ts';
import {
	deleteUnusedCriteriaOption,
	deleteUnusedLookupEntry,
	findOrCreateCriteriaOption,
	findOrCreateLookupEntry,
	type LookupKind
} from './lookups.ts';
import {
	drinkItemDetails,
	foodItemDetails,
	mediaFiles,
	places,
	reviewCategoryRatings,
	reviewItemFoodTypes,
	reviewItems,
	reviewMedia,
	reviewRatingCriteria,
	reviews
} from './db/schema/index.ts';

/** The subset of a `rating_categories` row the builder needs to decide which categories
 *  apply to a given review, kept narrow so tests don't need a full DB row shape. */
/** Thrown when a publish payload's photo claims don't check out against Cloudinary's own
 *  signatures or this user's upload folder — see cloudinarySignatureValid / publicIdBelongsToUser. */
export class InvalidPhotoError extends Error {
	constructor(publicId: string) {
		super(`Photo ${publicId} failed verification`);
		this.name = 'InvalidPhotoError';
	}
}

/** Thrown when a publish payload's client-generated `reviewId` already belongs to a review
 *  owned by someone else — see publishReview's ownership check. `reviewId` is visible in
 *  `/review/<id>` URLs, so this must be rejected outright rather than silently merged: every
 *  child row (category ratings, items, media, ...) is keyed off `reviewId` via a deterministic
 *  id, so a forged id would otherwise let an attacker splice extra rows into another user's
 *  already-published review. */
export class ReviewOwnershipError extends Error {
	constructor() {
		super('This review cannot be published.');
		this.name = 'ReviewOwnershipError';
	}
}

export interface RatingCategoryFlags {
	id: number;
	appliesToFood: boolean;
	appliesToDrink: boolean;
	appliesToPlace: boolean;
	appliesToDineIn: boolean;
	appliesToTakeaway: boolean;
	appliesToDelivery: boolean;
}

export interface PublishContext {
	userId: string;
	now: Date;
	categories: RatingCategoryFlags[];
	/** Cloudinary public_id -> existing media_files.id, for photos already uploaded by a
	 *  previous attempt at this same review (see publishReview's pre-flight read). */
	mediaIdByPublicId: Map<string, string>;
}

export interface NewPlaceRow {
	id: string;
	name: string;
	placeCategoryId: number | null;
	lat: number;
	lng: number;
	addressLine1: string | null;
	city: string | null;
	countryCode: string;
	createdByUserId: string;
}

export interface ReviewRowSet {
	newPlace: NewPlaceRow | null;
	review: typeof reviews.$inferInsert;
	items: (typeof reviewItems.$inferInsert)[];
	foodDetails: (typeof foodItemDetails.$inferInsert)[];
	itemFoodTypes: (typeof reviewItemFoodTypes.$inferInsert)[];
	drinkDetails: (typeof drinkItemDetails.$inferInsert)[];
	newMedia: (typeof mediaFiles.$inferInsert & { version: number })[];
	reviewMedia: (typeof reviewMedia.$inferInsert)[];
	categoryRatings: (typeof reviewCategoryRatings.$inferInsert)[];
	ratingCriteria: (typeof reviewRatingCriteria.$inferInsert)[];
}

/** Whether a place-scoped category (Price, Service, Hygiene, Amenities, ...) applies to this
 *  visit type. drive_through/other have no dedicated flag in the schema, so they're never
 *  excluded on that basis — only dine_in/takeaway/delivery gate anything. */
function categoryAppliesToVisit(
	category: RatingCategoryFlags,
	visitType: PublishReview['visitType']
): boolean {
	switch (visitType) {
		case 'dine_in':
			return category.appliesToDineIn;
		case 'takeaway':
			return category.appliesToTakeaway;
		case 'delivery':
			return category.appliesToDelivery;
		default:
			return true;
	}
}

/** The category ids a forged or stale payload is allowed to attach a place-scoped rating to,
 *  for this review's visit type. Exported so a test can assert e.g. that delivery drops Amenities. */
export function applicablePlaceCategoryIds(
	categories: RatingCategoryFlags[],
	visitType: PublishReview['visitType']
): Set<number> {
	return new Set(
		categories
			.filter((c) => c.appliesToPlace && categoryAppliesToVisit(c, visitType))
			.map((c) => c.id)
	);
}

/** The category ids allowed for an item-scoped rating (Food quality / Drink quality), by item type. */
export function applicableItemCategoryIds(
	categories: RatingCategoryFlags[],
	itemType: 'food' | 'drink'
): Set<number> {
	const flag = itemType === 'food' ? 'appliesToFood' : 'appliesToDrink';
	return new Set(categories.filter((c) => c[flag]).map((c) => c.id));
}

/** WKT, longitude before latitude — swapping them silently places a point on the wrong
 *  continent, since both are valid-looking numbers. */
export function pointWkt(lat: number, lng: number): string {
	return `SRID=4326;POINT(${lng} ${lat})`;
}

/**
 * Deterministic, uuid-shaped id derived from stable inputs — never crypto.randomUUID(). A
 * retried or double-submitted publish calls buildReviewRows again for the same reviewId and
 * must reproduce the exact same child ids, or onConflictDoNothing in publishReview's batch
 * can't recognize the retry and inserts true duplicates under fresh random ids. Not
 * security-sensitive (never used as a token/credential), so a truncated SHA-256 is fine —
 * this only needs to be stable and collision-free for our own ids, not unguessable.
 */
function stableId(...parts: string[]): string {
	const hash = createHash('sha256').update(parts.join(':')).digest('hex');
	return [
		hash.slice(0, 8),
		hash.slice(8, 12),
		`4${hash.slice(13, 16)}`,
		`${((parseInt(hash[16]!, 16) & 0x3) | 0x8).toString(16)}${hash.slice(17, 20)}`,
		hash.slice(20, 32)
	].join('-');
}

/** 1 decimal place, matching numeric(2,1); numeric columns round-trip as strings in Drizzle. */
function toDecimalString(n: number): string {
	return n.toFixed(1);
}

function average(values: number[]): number | null {
	if (values.length === 0) return null;
	return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Builds every row a publish needs to write, purely from validated input plus lookup context.
 *  Every child id is derived with stableId rather than randomUUID, so the whole graph can be
 *  built up front — neon-http's db.batch() is one non-interactive transaction, so nothing can
 *  read a RETURNING value mid-batch — and so a retry reproduces identical ids end to end. */
export function buildReviewRows(input: PublishReview, ctx: PublishContext): ReviewRowSet {
	const reviewId = input.reviewId;

	let placeId: string;
	let newPlace: NewPlaceRow | null = null;
	if (input.place.kind === 'existing') {
		placeId = input.place.placeId;
	} else {
		placeId = stableId(reviewId, 'place');
		newPlace = {
			id: placeId,
			name: input.place.name,
			placeCategoryId: input.place.placeCategoryId,
			lat: input.place.lat,
			lng: input.place.lng,
			addressLine1: input.place.addressLine1,
			city: input.place.city,
			countryCode: input.place.countryCode,
			createdByUserId: ctx.userId
		};
	}

	const items: ReviewRowSet['items'] = [];
	const foodDetails: ReviewRowSet['foodDetails'] = [];
	const itemFoodTypes: ReviewRowSet['itemFoodTypes'] = [];
	const drinkDetails: ReviewRowSet['drinkDetails'] = [];
	const categoryRatings: ReviewRowSet['categoryRatings'] = [];
	const ratingCriteria: ReviewRowSet['ratingCriteria'] = [];

	const allRatingValues: number[] = [];

	function addCategoryRatings(
		itemId: string | null,
		ratings: ReviewItemInput['ratings'],
		allowedIds: Set<number>
	) {
		const scope = itemId ?? 'place';
		for (const rating of ratings) {
			if (!allowedIds.has(rating.ratingCategoryId)) continue; // see applicable*CategoryIds
			const id = stableId(reviewId, 'rating', scope, String(rating.ratingCategoryId));
			categoryRatings.push({
				id,
				reviewId,
				reviewItemId: itemId,
				ratingCategoryId: rating.ratingCategoryId,
				ratingValue: rating.ratingValue === null ? null : toDecimalString(rating.ratingValue),
				isApplicable: rating.isApplicable,
				comment: rating.comment
			});
			if (rating.isApplicable && rating.ratingValue !== null)
				allRatingValues.push(rating.ratingValue);
			for (const criteriaOptionId of rating.criteriaOptionIds) {
				ratingCriteria.push({ reviewCategoryRatingId: id, criteriaOptionId });
			}
		}
	}

	input.items.forEach((item, index) => {
		const itemId = stableId(reviewId, 'item', String(index));
		items.push({
			id: itemId,
			reviewId,
			itemType: item.itemType,
			itemName: item.itemName,
			description: item.description,
			price: item.price === null ? null : toDecimalString(item.price),
			taxPercent: item.taxPercent === null ? null : toDecimalString(item.taxPercent),
			currencyCode: item.currencyCode,
			individualRating:
				item.individualRating === null ? null : toDecimalString(item.individualRating),
			isFavorite: item.isFavorite,
			isLeastFavorite: item.isLeastFavorite,
			displayOrder: index
		});

		if (item.itemType === 'food') {
			foodDetails.push({
				reviewItemId: itemId,
				cuisineTypeId: item.cuisineTypeId,
				portionSize: item.portionSize,
				tasteNotes: item.tasteNotes
			});
			for (const foodTypeId of item.foodTypeIds) {
				itemFoodTypes.push({ reviewItemId: itemId, foodTypeId });
			}
		} else {
			drinkDetails.push({
				reviewItemId: itemId,
				drinkTypeId: item.drinkTypeId,
				sizeLabel: item.sizeLabel,
				sugarLevelPercent: item.sugarLevelPercent,
				iceLevel: item.iceLevel
			});
		}

		addCategoryRatings(
			itemId,
			item.ratings,
			applicableItemCategoryIds(ctx.categories, item.itemType)
		);
	});

	addCategoryRatings(
		null,
		input.placeRatings,
		applicablePlaceCategoryIds(ctx.categories, input.visitType)
	);

	const newMedia: ReviewRowSet['newMedia'] = [];
	const reviewMediaRows: ReviewRowSet['reviewMedia'] = [];
	input.photos.forEach((photo, index) => {
		const existingId = ctx.mediaIdByPublicId.get(photo.publicId);
		// Keyed by publicId alone (not reviewId): publicId is media_files' natural key, so this
		// stays the same id regardless of which review first introduces this photo.
		const mediaId = existingId ?? stableId('media', photo.publicId);
		if (!existingId) {
			newMedia.push({
				id: mediaId,
				ownerUserId: ctx.userId,
				storageKey: photo.publicId,
				url: '', // overwritten by publishReview with a server-reconstructed Cloudinary URL
				format: photo.format,
				width: photo.width,
				height: photo.height,
				bytes: photo.bytes,
				version: photo.version
			});
		}
		reviewMediaRows.push({
			reviewId,
			mediaId,
			mediaType: 'general',
			caption: photo.caption,
			displayOrder: index,
			isCover: photo.isCover
		});
	});

	const overallRating = average(allRatingValues);

	const review: ReviewRowSet['review'] = {
		id: reviewId,
		userId: ctx.userId,
		placeId,
		reviewType: input.reviewType,
		visitType: input.visitType,
		mealType: input.mealType,
		visitedAt: new Date(input.visitedAt),
		overallRating: overallRating === null ? toDecimalString(1) : toDecimalString(overallRating),
		title: input.title,
		description: input.description,
		visibility: input.visibility,
		reviewStatus: 'published',
		isFavorite: input.isFavorite,
		isVerifiedVisit: false,
		publishedAt: ctx.now,
		createdAt: ctx.now,
		updatedAt: ctx.now
	};

	return {
		newPlace,
		review,
		items,
		foodDetails,
		itemFoodTypes,
		drinkDetails,
		newMedia,
		reviewMedia: reviewMediaRows,
		categoryRatings,
		ratingCriteria
	};
}

/** A photo whose existing media_files row is already `mediaStatus: 'deleted'` means the
 *  orphaned-photo cleanup job's claimOrphanForDeletion (photoCleanup.ts) has already committed
 *  to destroying its Cloudinary asset, or already has — reusing that id here would silently
 *  publish a review pointing at a dead (or about-to-be-dead) photo. Treated the same as a photo
 *  that failed Cloudinary verification: the publish is rejected and the user has to re-upload
 *  it. Exported and pure so it's unit-testable without a DB. */
export function assertNoDeletedMedia(rows: { storageKey: string; mediaStatus: string }[]): void {
	const deleted = rows.find((r) => r.mediaStatus === 'deleted');
	if (deleted) throw new InvalidPhotoError(deleted.storageKey);
}

/** Looks up which of the given Cloudinary public_ids already have a media_files row, so a
 *  retried publish (or a photo picked from an earlier draft) reuses the row instead of
 *  violating storage_key's unique constraint inside the batch below. Rejects outright (see
 *  assertNoDeletedMedia) if any of them has already been claimed by the orphan-cleanup job. */
async function findExistingMediaIds(publicIds: string[]): Promise<Map<string, string>> {
	if (publicIds.length === 0) return new Map();
	const rows = await db
		.select({
			id: mediaFiles.id,
			storageKey: mediaFiles.storageKey,
			mediaStatus: mediaFiles.mediaStatus
		})
		.from(mediaFiles)
		.where(inArray(mediaFiles.storageKey, publicIds));
	assertNoDeletedMedia(rows);
	return new Map(rows.map((r) => [r.storageKey, r.id]));
}

/** Tracks lookup/criteria rows newly inserted while resolving a publish's "Other…" entries, so
 *  they can be rolled back with rollbackCreatedEntries if the publish fails afterward — a row
 *  this collector didn't add was reused from an earlier request and must never be deleted. */
interface CreatedEntries {
	lookups: { kind: LookupKind; id: number }[];
	criteria: number[];
}

async function rollbackCreatedEntries(created: CreatedEntries): Promise<void> {
	await Promise.all([
		...created.lookups.map((l) => deleteUnusedLookupEntry(l.kind, l.id)),
		...created.criteria.map((id) => deleteUnusedCriteriaOption(id))
	]);
}

/** Resolves a rating's "+"-added custom tags into real rating_criteria_options rows, creating
 *  one if it doesn't exist yet — see findOrCreateCriteriaOption. Done here, right before the
 *  review is actually written; newly created rows are recorded in `created` and rolled back by
 *  the caller if the publish fails afterward (see rollbackCreatedEntries). */
async function resolveRatingCustomCriteria(
	rating: CategoryRatingInput,
	created: CreatedEntries
): Promise<CategoryRatingInput> {
	if (rating.customCriteria.length === 0) return rating;
	// allSettled, not all: these run in parallel, and if one rejects (an empty slug, a transient
	// DB error) while a sibling has already inserted its own row, Promise.all would reject
	// immediately without ever reading that sibling's result — losing it from `created` and
	// leaving an orphaned criteria option that rollbackCreatedEntries can never know to delete.
	// Recording every fulfilled result first, then rethrowing, keeps that tracking complete.
	const settled = await Promise.allSettled(
		rating.customCriteria.map((c) =>
			findOrCreateCriteriaOption(rating.ratingCategoryId, c.sentiment, c.label)
		)
	);
	const resolvedIds: number[] = [];
	for (const s of settled) {
		if (s.status !== 'fulfilled') continue;
		if (s.value.created) created.criteria.push(s.value.id);
		resolvedIds.push(s.value.id);
	}
	const rejected = settled.find((s) => s.status === 'rejected');
	if (rejected?.status === 'rejected') throw rejected.reason;
	return {
		...rating,
		criteriaOptionIds: [...new Set([...rating.criteriaOptionIds, ...resolvedIds])],
		customCriteria: []
	};
}

/** Resolves any "Other…" lookup names typed into the wizard (cuisine / food / drink type)
 *  into real rows, creating one if it doesn't exist yet — see findOrCreateLookupEntry. Also
 *  resolves each item-scoped rating's custom criteria (see resolveRatingCustomCriteria). Newly
 *  created rows are recorded in `created` and rolled back by the caller if the publish fails
 *  afterward (see rollbackCreatedEntries). */
function resolveItemLookupOthers(
	items: ReviewItemInput[],
	created: CreatedEntries
): Promise<ReviewItemInput[]> {
	return Promise.all(
		items.map(async (item) => {
			const ratings = await Promise.all(
				item.ratings.map((r) => resolveRatingCustomCriteria(r, created))
			);
			if (item.itemType === 'food') {
				// allSettled — same reason as resolveRatingCustomCriteria above: cuisine and food
				// type resolve in parallel, and either one creating a row before the other rejects
				// must still get recorded, not lost to Promise.all's immediate-reject behavior.
				const [cuisineResult, foodTypeResult] = await Promise.allSettled([
					item.cuisineTypeOther ? findOrCreateLookupEntry('cuisine', item.cuisineTypeOther) : null,
					item.foodTypeOther ? findOrCreateLookupEntry('food', item.foodTypeOther) : null
				]);
				if (cuisineResult.status === 'fulfilled' && cuisineResult.value?.created) {
					created.lookups.push({ kind: 'cuisine', id: cuisineResult.value.id });
				}
				if (foodTypeResult.status === 'fulfilled' && foodTypeResult.value?.created) {
					created.lookups.push({ kind: 'food', id: foodTypeResult.value.id });
				}
				if (cuisineResult.status === 'rejected') throw cuisineResult.reason;
				if (foodTypeResult.status === 'rejected') throw foodTypeResult.reason;
				const cuisine = cuisineResult.value;
				const foodType = foodTypeResult.value;
				return {
					...item,
					ratings,
					cuisineTypeId: cuisine ? cuisine.id : item.cuisineTypeId,
					foodTypeIds: foodType ? [...item.foodTypeIds, foodType.id] : item.foodTypeIds
				};
			}
			const drinkType = item.drinkTypeOther
				? await findOrCreateLookupEntry('drink', item.drinkTypeOther)
				: null;
			if (drinkType?.created) created.lookups.push({ kind: 'drink', id: drinkType.id });
			return { ...item, ratings, drinkTypeId: drinkType ? drinkType.id : item.drinkTypeId };
		})
	);
}

/** Validates, builds, and atomically writes a full review. See buildReviewRows for the pure
 *  half of this; this function only does I/O (the pre-flight read and the batch itself). */
export async function publishReview(
	userId: string,
	input: PublishReview,
	categories: RatingCategoryFlags[]
) {
	// `reviewId` is client-generated (ReviewDraft's crypto.randomUUID()) and every child row is
	// keyed off it deterministically (see stableId) with onConflictDoNothing — so without this
	// check, submitting another user's reviewId (visible in /review/<id>) would silently splice
	// new category-rating/media/etc. rows into their already-published review instead of being
	// rejected. A same-user resubmit of an id that already published is treated as an idempotent
	// no-op rather than merging more rows into it.
	const [existing] = await db
		.select({ userId: reviews.userId })
		.from(reviews)
		.where(eq(reviews.id, input.reviewId))
		.limit(1);
	if (existing) {
		if (existing.userId !== userId) throw new ReviewOwnershipError();
		return input.reviewId;
	}

	for (const photo of input.photos) {
		if (!publicIdBelongsToUser(photo.publicId, userId) || !cloudinarySignatureValid(photo)) {
			throw new InvalidPhotoError(photo.publicId);
		}
	}

	// Declared outside the try so the catch below can still reach it if resolution itself is
	// what fails — findOrCreateLookupEntry/findOrCreateCriteriaOption push into it as each call
	// succeeds, independently of whether a sibling call in the same batch goes on to fail.
	const created: CreatedEntries = { lookups: [], criteria: [] };

	try {
		const resolvedInput: PublishReview = {
			...input,
			items: (await resolveItemLookupOthers(input.items, created)) as PublishReview['items'],
			placeRatings: await Promise.all(
				input.placeRatings.map((r) => resolveRatingCustomCriteria(r, created))
			)
		};

		const mediaIdByPublicId = await findExistingMediaIds(
			resolvedInput.photos.map((p) => p.publicId)
		);

		const rows = buildReviewRows(resolvedInput, {
			userId,
			now: new Date(),
			categories,
			mediaIdByPublicId
		});

		const mediaRowsWithUrl = rows.newMedia.map(({ version, ...row }) => ({
			...row,
			url: deliveryUrl(row.storageKey, version, row.format ?? null),
			// A brand new row goes straight to 'active' — no publish without it, unlike a row
			// reused below that may have been sitting at 'pending' since upload time.
			mediaStatus: 'active' as const
		}));

		const statements: BatchItem<'pg'>[] = [];
		if (rows.newPlace) {
			const p = rows.newPlace;
			statements.push(
				db
					.insert(places)
					.values({
						id: p.id,
						placeCategoryId: p.placeCategoryId,
						name: p.name,
						location: sql`ST_GeogFromText(${pointWkt(p.lat, p.lng)})`,
						addressLine1: p.addressLine1,
						city: p.city,
						countryCode: p.countryCode,
						createdByUserId: p.createdByUserId,
						verificationStatus: 'unverified'
					})
					.onConflictDoNothing()
			);
		}
		statements.push(db.insert(reviews).values(rows.review).onConflictDoNothing());
		if (mediaRowsWithUrl.length) {
			statements.push(db.insert(mediaFiles).values(mediaRowsWithUrl).onConflictDoNothing());
		}
		if (resolvedInput.photos.length) {
			// Flips any row already sitting at 'pending' (registered at upload time, see
			// /api/photos/register) to 'active' now that its review has actually published — the
			// insert above already writes a brand new row as 'active', so this only ever matters
			// for one reused via findExistingMediaIds. Keeps findOrphanedAssets' pending-vs-active
			// distinction honest: a published photo must never still read as merely "pending".
			// Excludes 'deleted' as a last line of defense: findExistingMediaIds above already
			// rejected the whole publish if a row read as 'deleted' at that point, but this guards
			// the narrow remaining window where the cleanup job's claim (claimOrphanForDeletion)
			// could still land in between that read and this statement committing — without this,
			// such a race would resurrect a row cleanup has already committed to destroying.
			statements.push(
				db
					.update(mediaFiles)
					.set({ mediaStatus: 'active' })
					.where(
						and(
							inArray(
								mediaFiles.storageKey,
								resolvedInput.photos.map((p) => p.publicId)
							),
							ne(mediaFiles.mediaStatus, 'deleted')
						)
					)
			);
		}
		statements.push(db.insert(reviewItems).values(rows.items).onConflictDoNothing());
		if (rows.foodDetails.length) {
			statements.push(db.insert(foodItemDetails).values(rows.foodDetails).onConflictDoNothing());
		}
		if (rows.itemFoodTypes.length) {
			statements.push(
				db.insert(reviewItemFoodTypes).values(rows.itemFoodTypes).onConflictDoNothing()
			);
		}
		if (rows.drinkDetails.length) {
			statements.push(db.insert(drinkItemDetails).values(rows.drinkDetails).onConflictDoNothing());
		}
		if (rows.categoryRatings.length) {
			statements.push(
				db.insert(reviewCategoryRatings).values(rows.categoryRatings).onConflictDoNothing()
			);
		}
		if (rows.ratingCriteria.length) {
			statements.push(
				db.insert(reviewRatingCriteria).values(rows.ratingCriteria).onConflictDoNothing()
			);
		}
		if (rows.reviewMedia.length) {
			statements.push(db.insert(reviewMedia).values(rows.reviewMedia).onConflictDoNothing());
		}

		await db.batch(statements as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);

		return input.reviewId;
	} catch (err) {
		await rollbackCreatedEntries(created);
		throw err;
	}
}
