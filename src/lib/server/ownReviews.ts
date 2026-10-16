/**
 * What an author can do to their own published review from the journal: archive it, bring it
 * back, delete it, and undo that delete.
 *
 * Each is one UPDATE scoped by `user_id`, so ownership is enforced by the statement itself
 * rather than a read-then-write that could race. A false return means "no row matched": not
 * yours, no such review, or already in the requested state. The routes turn all of those into
 * the same 404, so a guessed id can't tell "someone else's" from "doesn't exist".
 */
import { error } from '@sveltejs/kit';
import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
	emptyItem,
	type CategoryRatingDraft,
	type ItemDraft,
	type MealType,
	type ReviewTypeChoice,
	type VisitType
} from '#lib/review/draft.svelte.ts';
import type { ReviewDraftSnapshot } from '#lib/review/payload.ts';
import { requireUser } from './auth.ts';
import { db } from './db/index.ts';
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
import { toNumber } from './feed.ts';

const ownLive = (reviewId: string, userId: string) =>
	and(
		eq(reviews.id, reviewId),
		eq(reviews.userId, userId),
		eq(reviews.reviewStatus, 'published'),
		isNull(reviews.deletedAt)
	);

/** Archive or restore from the archive. Idempotent: archiving an archived review succeeds. */
export async function setReviewArchived(
	reviewId: string,
	userId: string,
	archived: boolean
): Promise<boolean> {
	const rows = await db
		.update(reviews)
		.set({ archivedAt: archived ? new Date() : null })
		.where(ownLive(reviewId, userId))
		.returning({ id: reviews.id });
	return rows.length > 0;
}

/** Soft delete. The row, its photos and comments stay, so the journal's Undo can bring it all
 *  back with restoreDeletedReview. */
export async function softDeleteReview(reviewId: string, userId: string): Promise<boolean> {
	const rows = await db
		.update(reviews)
		.set({ deletedAt: new Date() })
		.where(ownLive(reviewId, userId))
		.returning({ id: reviews.id });
	return rows.length > 0;
}

export async function restoreDeletedReview(reviewId: string, userId: string): Promise<boolean> {
	const rows = await db
		.update(reviews)
		.set({ deletedAt: null })
		.where(
			and(
				eq(reviews.id, reviewId),
				eq(reviews.userId, userId),
				eq(reviews.reviewStatus, 'published'),
				isNotNull(reviews.deletedAt)
			)
		)
		.returning({ id: reviews.id });
	return rows.length > 0;
}

/** The gate for the author-only routes: 401 signed out, 404 for a non-uuid id. Whether the
 *  review is actually theirs is left to the scoped UPDATE above. */
export async function requireOwnReviewRequest(locals: App.Locals, reviewId: string) {
	const user = await requireUser(locals);
	if (!z.uuid().safeParse(reviewId).success) error(404, 'Review not found');
	return user;
}

const REVIEW_TYPE: Record<string, ReviewTypeChoice> = {
	food: 'dish',
	drink: 'beverage',
	combined: 'both'
};

/** A numeric column as the wizard's raw-text money field: "6.5", or "" when unset. */
const moneyText = (v: string | null) => {
	const n = toNumber(v);
	return n === null ? '' : String(n);
};

/**
 * The author's own live review, rebuilt in the wizard's shape so Edit opens with every field as
 * it was published — the inverse of buildPublishPayload + buildReviewRows. Null when the review
 * doesn't exist, isn't theirs, or is deleted (the route turns that into a 404).
 *
 * Custom tags were turned into real rating_criteria_options rows at publish time, so they come
 * back as plain criteriaOptionIds; photos come back marked `existing`, to be sent back by
 * public id (see updateReviewSchema).
 */
export async function getReviewForEdit(
	reviewId: string,
	userId: string
): Promise<ReviewDraftSnapshot | null> {
	const [review] = await db
		.select({
			id: reviews.id,
			reviewType: reviews.reviewType,
			visitType: reviews.visitType,
			mealType: reviews.mealType,
			visitedAt: reviews.visitedAt,
			title: reviews.title,
			description: reviews.description,
			visibility: reviews.visibility,
			isFavorite: reviews.isFavorite,
			placeId: places.id,
			placeName: places.name,
			placeAddressLine1: places.addressLine1,
			placeCity: places.city
		})
		.from(reviews)
		.innerJoin(places, eq(reviews.placeId, places.id))
		.where(
			and(
				eq(reviews.id, reviewId),
				eq(reviews.userId, userId),
				eq(reviews.reviewStatus, 'published'),
				isNull(reviews.deletedAt)
			)
		)
		.limit(1);
	if (!review) return null;

	const [itemRows, foodTypeRows, ratingRows, photoRows] = await db.batch([
		db
			.select({
				id: reviewItems.id,
				itemType: reviewItems.itemType,
				itemName: reviewItems.itemName,
				description: reviewItems.description,
				price: reviewItems.price,
				taxPercent: reviewItems.taxPercent,
				currencyCode: reviewItems.currencyCode,
				individualRating: reviewItems.individualRating,
				isFavorite: reviewItems.isFavorite,
				isLeastFavorite: reviewItems.isLeastFavorite,
				cuisineTypeId: foodItemDetails.cuisineTypeId,
				portionSize: foodItemDetails.portionSize,
				tasteNotes: foodItemDetails.tasteNotes,
				drinkTypeId: drinkItemDetails.drinkTypeId,
				sizeLabel: drinkItemDetails.sizeLabel,
				sugarLevelPercent: drinkItemDetails.sugarLevelPercent,
				iceLevel: drinkItemDetails.iceLevel
			})
			.from(reviewItems)
			.leftJoin(foodItemDetails, eq(foodItemDetails.reviewItemId, reviewItems.id))
			.leftJoin(drinkItemDetails, eq(drinkItemDetails.reviewItemId, reviewItems.id))
			.where(eq(reviewItems.reviewId, reviewId))
			.orderBy(asc(reviewItems.displayOrder)),
		db
			.select({
				reviewItemId: reviewItemFoodTypes.reviewItemId,
				id: reviewItemFoodTypes.foodTypeId
			})
			.from(reviewItemFoodTypes)
			.innerJoin(reviewItems, eq(reviewItemFoodTypes.reviewItemId, reviewItems.id))
			.where(eq(reviewItems.reviewId, reviewId)),
		db
			.select({
				id: reviewCategoryRatings.id,
				reviewItemId: reviewCategoryRatings.reviewItemId,
				ratingCategoryId: reviewCategoryRatings.ratingCategoryId,
				ratingValue: reviewCategoryRatings.ratingValue,
				comment: reviewCategoryRatings.comment
			})
			.from(reviewCategoryRatings)
			.where(eq(reviewCategoryRatings.reviewId, reviewId)),
		db
			.select({
				publicId: mediaFiles.storageKey,
				url: mediaFiles.url,
				format: mediaFiles.format,
				width: mediaFiles.width,
				height: mediaFiles.height,
				bytes: mediaFiles.bytes,
				caption: reviewMedia.caption,
				isCover: reviewMedia.isCover
			})
			.from(reviewMedia)
			.innerJoin(mediaFiles, eq(reviewMedia.mediaId, mediaFiles.id))
			.where(and(eq(reviewMedia.reviewId, reviewId), isNull(mediaFiles.deletedAt)))
			.orderBy(asc(reviewMedia.displayOrder))
	]);

	const criteriaRows = ratingRows.length
		? await db
				.select({
					ratingId: reviewRatingCriteria.reviewCategoryRatingId,
					optionId: reviewRatingCriteria.criteriaOptionId
				})
				.from(reviewRatingCriteria)
				.where(
					inArray(
						reviewRatingCriteria.reviewCategoryRatingId,
						ratingRows.map((r) => r.id)
					)
				)
		: [];

	const ratingsFor = (itemId: string | null): CategoryRatingDraft[] =>
		ratingRows
			.filter((r) => r.reviewItemId === itemId)
			.map((r) => ({
				ratingCategoryId: r.ratingCategoryId,
				ratingValue: toNumber(r.ratingValue),
				criteriaOptionIds: criteriaRows.filter((c) => c.ratingId === r.id).map((c) => c.optionId),
				customCriteria: [],
				comment: r.comment
			}));

	function itemDraft(type: 'food' | 'drink'): ItemDraft {
		const row = itemRows.find((i) => i.itemType === type);
		const base = emptyItem(type);
		if (!row) return base;
		return {
			...base,
			itemName: row.itemName,
			description: row.description,
			price: moneyText(row.price),
			taxPercent: moneyText(row.taxPercent),
			currencyCode: row.currencyCode ?? base.currencyCode,
			individualRating: toNumber(row.individualRating),
			isFavorite: row.isFavorite,
			isLeastFavorite: row.isLeastFavorite,
			ratings: ratingsFor(row.id),
			cuisineTypeId: row.cuisineTypeId,
			foodTypeIds: foodTypeRows.filter((f) => f.reviewItemId === row.id).map((f) => f.id),
			portionSize: (row.portionSize as ItemDraft['portionSize']) ?? null,
			tasteNotes: row.tasteNotes,
			drinkTypeId: row.drinkTypeId,
			sizeLabel: row.sizeLabel ?? '',
			sugarLevelPercent: row.sugarLevelPercent ?? base.sugarLevelPercent,
			iceLevel: row.iceLevel
		};
	}

	const visitType: VisitType = (['dine_in', 'takeaway', 'delivery'] as const).includes(
		review.visitType as VisitType
	)
		? (review.visitType as VisitType)
		: 'dine_in';

	return {
		reviewId: review.id,
		reviewType: REVIEW_TYPE[review.reviewType] ?? 'dish',
		visitType,
		mealType: (review.mealType as MealType | null) ?? 'lunch',
		// visitedAt is stored as midnight UTC of the picked date, so its first ten characters
		// are the date the person chose.
		visitedAt: review.visitedAt.toISOString().slice(0, 10),
		place: {
			id: review.placeId,
			name: review.placeName,
			addressLine1: review.placeAddressLine1,
			city: review.placeCity,
			distanceMeters: null
		},
		newPlaceName: '',
		dish: itemDraft('food'),
		drink: itemDraft('drink'),
		placeRatings: ratingsFor(null),
		isFavorite: review.isFavorite,
		title: review.title ?? '',
		description: review.description ?? '',
		visibility: review.visibility as ReviewDraftSnapshot['visibility'],
		photos: photoRows.map((p) => ({
			publicId: p.publicId,
			version: 1,
			signature: '',
			format: p.format ?? '',
			width: p.width ?? 1,
			height: p.height ?? 1,
			bytes: p.bytes ?? 1,
			caption: p.caption,
			isCover: p.isCover,
			previewUrl: p.url,
			existing: true
		}))
	};
}
