import { z } from 'zod';

/**
 * Shared between the wizard (client-side step validation) and the `publish` action
 * (server-side, authoritative). Fields the server computes itself — overallRating,
 * publishedAt, userId, isVerifiedVisit, and each photo's url — are deliberately not
 * accepted here; see src/lib/server/reviews.ts.
 */

const starRating = z.number().min(1).max(5).multipleOf(0.5); // numeric(2,1)
const money = z.number().nonnegative().max(1_000_000_000);

export const placeRefSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('existing'), placeId: z.uuid() }),
	z.object({
		kind: z.literal('new'),
		name: z.string().trim().min(1).max(200),
		placeCategoryId: z.number().int().positive().nullable().default(null),
		lat: z.number().min(-90).max(90),
		lng: z.number().min(-180).max(180),
		addressLine1: z.string().max(255).nullable().default(null),
		city: z.string().max(100).nullable().default(null),
		countryCode: z.string().length(2)
	})
]);

export const categoryRatingSchema = z.object({
	ratingCategoryId: z.number().int().positive(),
	ratingValue: starRating.nullable(),
	isApplicable: z.boolean().default(true),
	criteriaOptionIds: z.array(z.number().int().positive()).max(12).default([]),
	comment: z.string().max(500).nullable().default(null)
});

const baseItemFields = {
	itemName: z.string().trim().min(1).max(200),
	description: z.string().max(2000).nullable().default(null),
	price: money.nullable().default(null),
	taxPercent: z.number().min(0).max(999).nullable().default(null),
	currencyCode: z.string().length(3).nullable().default(null),
	individualRating: starRating.nullable().default(null),
	isFavorite: z.boolean().default(false),
	isLeastFavorite: z.boolean().default(false),
	/** Item-scoped ratings, e.g. Food quality / Drink quality for this item. */
	ratings: z.array(categoryRatingSchema).max(6).default([])
};

const itemPreferenceRefine = (i: { isFavorite: boolean; isLeastFavorite: boolean }) =>
	!(i.isFavorite && i.isLeastFavorite);

export const foodItemSchema = z
	.object({
		...baseItemFields,
		itemType: z.literal('food'),
		cuisineTypeId: z.number().int().positive().nullable().default(null),
		foodTypeIds: z.array(z.number().int().positive()).max(8).default([]),
		portionSize: z.enum(['small', 'regular', 'large']).nullable().default(null),
		tasteNotes: z.string().max(200).nullable().default(null)
	})
	.refine(itemPreferenceRefine, { message: 'chk_review_item_preference', path: ['isFavorite'] });

export const drinkItemSchema = z
	.object({
		...baseItemFields,
		itemType: z.literal('drink'),
		drinkTypeId: z.number().int().positive().nullable().default(null),
		sizeLabel: z.string().max(30).nullable().default(null),
		sugarLevelPercent: z.number().int().min(0).max(200).nullable().default(null),
		iceLevel: z.string().max(30).nullable().default(null)
	})
	.refine(itemPreferenceRefine, { message: 'chk_review_item_preference', path: ['isFavorite'] });

export const reviewItemSchema = z.discriminatedUnion('itemType', [foodItemSchema, drinkItemSchema]);

export const reviewPhotoSchema = z.object({
	publicId: z.string().min(1).max(255),
	version: z.number().int().positive(),
	signature: z.string().min(1),
	format: z.string().max(20),
	width: z.number().int().positive(),
	height: z.number().int().positive(),
	bytes: z.number().int().positive().max(12_000_000),
	caption: z.string().max(500).nullable().default(null),
	isCover: z.boolean().default(false)
});

export const publishReviewSchema = z
	.object({
		/** Minted client-side at step 1, carried through the whole wizard. Doubles as an
		 *  idempotency key: every insert uses it (or a derived id) with onConflictDoNothing,
		 *  so resubmitting the same payload is a no-op rather than a duplicate review. */
		reviewId: z.uuid(),
		reviewType: z.enum(['food', 'drink', 'combined', 'general']),
		visitType: z.enum(['dine_in', 'takeaway', 'delivery', 'drive_through', 'other']),
		mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).nullable().default(null),
		visitedAt: z.iso.datetime(),
		place: placeRefSchema,
		title: z.string().max(200).nullable().default(null),
		description: z.string().max(3000).nullable().default(null),
		visibility: z.enum(['public', 'friends', 'private']).default('public'),
		/** The overall "keep on favorites shelf" toggle — reviews.isFavorite. Distinct from an
		 *  item's own isFavorite/isLeastFavorite, which marks the best/worst dish in a multi-item order. */
		isFavorite: z.boolean().default(false),
		items: z.array(reviewItemSchema).min(1).max(2),
		/** Place-scoped ratings — Price, Service, Hygiene, Amenities. reviewItemId is null for
		 *  these. No minimum: the prototype's own validate() never requires a rating to
		 *  publish, only a place and an item name. */
		placeRatings: z.array(categoryRatingSchema).max(6),
		photos: z.array(reviewPhotoSchema).max(10)
	})
	.superRefine((v, ctx) => {
		if (v.reviewType === 'drink' && v.mealType !== null) {
			ctx.addIssue({
				code: 'custom',
				path: ['mealType'],
				message: 'drink-only reviews have no meal type'
			});
		}
		if (v.reviewType === 'combined' && v.items.length !== 2) {
			ctx.addIssue({
				code: 'custom',
				path: ['items'],
				message: 'a combined review needs exactly one food and one drink item'
			});
		}
		if (v.reviewType === 'food' && v.items.some((i) => i.itemType !== 'food')) {
			ctx.addIssue({ code: 'custom', path: ['items'], message: 'expected only food items' });
		}
		if (v.reviewType === 'drink' && v.items.some((i) => i.itemType !== 'drink')) {
			ctx.addIssue({ code: 'custom', path: ['items'], message: 'expected only drink items' });
		}
		const coverCount = v.photos.filter((p) => p.isCover).length;
		if (coverCount > 1) {
			ctx.addIssue({ code: 'custom', path: ['photos'], message: 'uq_review_cover_image' });
		}
		const seenCategories = new Set<number>();
		for (const r of v.placeRatings) {
			if (seenCategories.has(r.ratingCategoryId)) {
				ctx.addIssue({
					code: 'custom',
					path: ['placeRatings'],
					message: 'uq_review_place_category_rating'
				});
				break;
			}
			seenCategories.add(r.ratingCategoryId);
		}
	});

export type PublishReview = z.infer<typeof publishReviewSchema>;
export type ReviewItemInput = z.infer<typeof reviewItemSchema>;
export type CategoryRatingInput = z.infer<typeof categoryRatingSchema>;
export type PlaceRefInput = z.infer<typeof placeRefSchema>;
