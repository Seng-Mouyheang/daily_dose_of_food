import { describe, expect, it } from 'vitest';
import {
	applicableItemCategoryIds,
	applicablePlaceCategoryIds,
	buildReviewRows,
	pointWkt,
	type PublishContext,
	type RatingCategoryFlags
} from './reviews.ts';
import type { PublishReview } from '../review/schema.ts';

/** Mirrors scripts/seed-data.ts's ratingCategorySeed. */
const CATEGORIES: RatingCategoryFlags[] = [
	{
		id: 1,
		appliesToFood: true,
		appliesToDrink: false,
		appliesToPlace: false,
		appliesToDineIn: true,
		appliesToTakeaway: true,
		appliesToDelivery: true
	},
	{
		id: 2,
		appliesToFood: false,
		appliesToDrink: true,
		appliesToPlace: false,
		appliesToDineIn: true,
		appliesToTakeaway: true,
		appliesToDelivery: true
	},
	{
		id: 3, // Price
		appliesToFood: false,
		appliesToDrink: false,
		appliesToPlace: true,
		appliesToDineIn: true,
		appliesToTakeaway: true,
		appliesToDelivery: true
	},
	{
		id: 6, // Amenities
		appliesToFood: false,
		appliesToDrink: false,
		appliesToPlace: true,
		appliesToDineIn: true,
		appliesToTakeaway: false,
		appliesToDelivery: false
	}
];

function ctx(overrides: Partial<PublishContext> = {}): PublishContext {
	return {
		userId: 'user-1',
		now: new Date('2026-01-01T00:00:00.000Z'),
		categories: CATEGORIES,
		mediaIdByPublicId: new Map(),
		...overrides
	};
}

function basePayload(overrides: Partial<PublishReview> = {}): PublishReview {
	return {
		reviewId: 'review-0',
		reviewType: 'food',
		visitType: 'dine_in',
		mealType: 'lunch',
		visitedAt: '2026-01-01T12:00:00.000Z',
		place: { kind: 'existing', placeId: 'place-1' },
		title: null,
		description: null,
		visibility: 'public',
		isFavorite: false,
		items: [
			{
				itemType: 'food',
				itemName: 'Fish amok',
				description: null,
				price: 7,
				taxPercent: 8,
				currencyCode: 'USD',
				individualRating: 4.5,
				isFavorite: false,
				isLeastFavorite: false,
				ratings: [
					{
						ratingCategoryId: 1,
						ratingValue: 4.5,
						isApplicable: true,
						criteriaOptionIds: [],
						comment: null
					}
				],
				cuisineTypeId: null,
				foodTypeIds: [],
				portionSize: null,
				tasteNotes: null
			}
		],
		placeRatings: [
			{
				ratingCategoryId: 3,
				ratingValue: 4,
				isApplicable: true,
				criteriaOptionIds: [],
				comment: null
			}
		],
		photos: [],
		...overrides
	};
}

describe('applicablePlaceCategoryIds', () => {
	it('drops Amenities for a delivery visit', () => {
		expect(applicablePlaceCategoryIds(CATEGORIES, 'delivery')).not.toContain(6);
		expect(applicablePlaceCategoryIds(CATEGORIES, 'delivery')).toContain(3);
	});

	it('keeps Amenities for dine-in', () => {
		expect(applicablePlaceCategoryIds(CATEGORIES, 'dine_in')).toContain(6);
	});

	it('excludes item-scoped categories entirely (they are not place-scoped)', () => {
		expect(applicablePlaceCategoryIds(CATEGORIES, 'dine_in')).not.toContain(1);
	});
});

describe('applicableItemCategoryIds', () => {
	it('food items only get appliesToFood categories', () => {
		expect(applicableItemCategoryIds(CATEGORIES, 'food')).toEqual(new Set([1]));
	});

	it('drink items only get appliesToDrink categories', () => {
		expect(applicableItemCategoryIds(CATEGORIES, 'drink')).toEqual(new Set([2]));
	});
});

describe('pointWkt', () => {
	it('puts longitude before latitude', () => {
		expect(pointWkt(11.5564, 104.9282)).toBe('SRID=4326;POINT(104.9282 11.5564)');
	});

	it('survives negative coordinates', () => {
		expect(pointWkt(-33.87, 151.21)).toBe('SRID=4326;POINT(151.21 -33.87)');
	});
});

describe('buildReviewRows', () => {
	it('wires every child row to an id that exists among the emitted parents', () => {
		const rows = buildReviewRows(basePayload(), ctx());

		const itemIds = new Set(rows.items.map((i) => i.id));
		for (const d of rows.foodDetails) expect(itemIds).toContain(d.reviewItemId);
		for (const d of rows.drinkDetails) expect(itemIds).toContain(d.reviewItemId);
		for (const t of rows.itemFoodTypes) expect(itemIds).toContain(t.reviewItemId);

		const ratingIds = new Set(rows.categoryRatings.map((r) => r.id));
		for (const c of rows.ratingCriteria) expect(ratingIds).toContain(c.reviewCategoryRatingId);

		for (const r of rows.categoryRatings) {
			expect(r.reviewId).toBe(rows.review.id);
			if (r.reviewItemId !== null) expect(itemIds).toContain(r.reviewItemId);
		}
		for (const m of rows.reviewMedia) {
			expect(m.reviewId).toBe(rows.review.id);
			const knownMediaId = rows.newMedia.some((n) => n.id === m.mediaId);
			expect(knownMediaId || [...ctx().mediaIdByPublicId.values()].includes(m.mediaId)).toBe(true);
		}
		expect(rows.items.every((i) => i.reviewId === rows.review.id)).toBe(true);
	});

	it('computes overallRating as a 1-decimal string, ignoring inapplicable ratings', () => {
		const rows = buildReviewRows(
			basePayload({
				items: [
					{
						...basePayload().items[0],
						ratings: [
							{
								ratingCategoryId: 1,
								ratingValue: 5,
								isApplicable: true,
								criteriaOptionIds: [],
								comment: null
							}
						]
					}
				],
				placeRatings: [
					{
						ratingCategoryId: 3,
						ratingValue: 3,
						isApplicable: true,
						criteriaOptionIds: [],
						comment: null
					},
					// Ignored: isApplicable false must not pull the average down.
					{
						ratingCategoryId: 6,
						ratingValue: 1,
						isApplicable: false,
						criteriaOptionIds: [],
						comment: null
					}
				]
			}),
			ctx()
		);
		expect(rows.review.overallRating).toBe('4.0');
		expect(typeof rows.review.overallRating).toBe('string');
	});

	it('drops a forged Amenities rating on a delivery review', () => {
		const rows = buildReviewRows(
			basePayload({
				visitType: 'delivery',
				placeRatings: [
					{
						ratingCategoryId: 3,
						ratingValue: 4,
						isApplicable: true,
						criteriaOptionIds: [],
						comment: null
					},
					{
						ratingCategoryId: 6,
						ratingValue: 5,
						isApplicable: true,
						criteriaOptionIds: [],
						comment: null
					}
				]
			}),
			ctx()
		);
		const placeScoped = rows.categoryRatings.filter((r) => r.reviewItemId === null);
		expect(placeScoped.map((r) => r.ratingCategoryId)).toEqual([3]);
	});

	it('emits no food details and a null mealType for a drink-only review', () => {
		const rows = buildReviewRows(
			basePayload({
				reviewType: 'drink',
				mealType: null,
				items: [
					{
						itemType: 'drink',
						itemName: 'Iced latte',
						description: null,
						price: 3,
						taxPercent: null,
						currencyCode: 'USD',
						individualRating: null,
						isFavorite: false,
						isLeastFavorite: false,
						ratings: [],
						drinkTypeId: null,
						sizeLabel: null,
						sugarLevelPercent: null,
						iceLevel: null
					}
				]
			}),
			ctx()
		);
		expect(rows.foodDetails).toHaveLength(0);
		expect(rows.drinkDetails).toHaveLength(1);
		expect(rows.review.mealType).toBeNull();
	});

	it('gives a combined review one food and one drink item with distinct ids and order', () => {
		const rows = buildReviewRows(
			basePayload({
				reviewType: 'combined',
				items: [
					basePayload().items[0],
					{
						itemType: 'drink',
						itemName: 'Iced latte',
						description: null,
						price: 3,
						taxPercent: null,
						currencyCode: 'USD',
						individualRating: null,
						isFavorite: false,
						isLeastFavorite: false,
						ratings: [],
						drinkTypeId: null,
						sizeLabel: null,
						sugarLevelPercent: null,
						iceLevel: null
					}
				]
			}),
			ctx()
		);
		expect(rows.items).toHaveLength(2);
		expect(new Set(rows.items.map((i) => i.id)).size).toBe(2);
		expect(rows.items.map((i) => i.displayOrder)).toEqual([0, 1]);
	});

	it('scopes place ratings with a null reviewItemId and item ratings with the item id', () => {
		const rows = buildReviewRows(basePayload(), ctx());
		const placeRating = rows.categoryRatings.find((r) => r.ratingCategoryId === 3);
		const itemRating = rows.categoryRatings.find((r) => r.ratingCategoryId === 1);
		expect(placeRating?.reviewItemId).toBeNull();
		expect(itemRating?.reviewItemId).toBe(rows.items[0]?.id);
	});

	it('gives photos sequential display order and reuses a known publicId instead of a new id', () => {
		const rows = buildReviewRows(
			basePayload({
				photos: [
					{
						publicId: 'p1',
						version: 1,
						signature: 'sig1',
						format: 'jpg',
						width: 100,
						height: 100,
						bytes: 1000,
						caption: null,
						isCover: true
					},
					{
						publicId: 'p2',
						version: 1,
						signature: 'sig2',
						format: 'jpg',
						width: 100,
						height: 100,
						bytes: 1000,
						caption: null,
						isCover: false
					}
				]
			}),
			ctx({ mediaIdByPublicId: new Map([['p2', 'existing-media-id']]) })
		);
		expect(rows.reviewMedia.map((m) => m.displayOrder)).toEqual([0, 1]);
		expect(rows.reviewMedia.filter((m) => m.isCover)).toHaveLength(1);
		expect(rows.newMedia).toHaveLength(1); // only p1 is new
		expect(rows.newMedia[0]?.storageKey).toBe('p1');
		const p2Row = rows.reviewMedia.find((m) => m.displayOrder === 1);
		expect(p2Row?.mediaId).toBe('existing-media-id');
	});

	it('sets server-controlled fields regardless of input', () => {
		const rows = buildReviewRows(basePayload(), ctx());
		expect(rows.review.publishedAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
		expect(rows.review.reviewStatus).toBe('published');
		expect(rows.review.isVerifiedVisit).toBe(false);
		expect(rows.review.userId).toBe('user-1');
	});
});
