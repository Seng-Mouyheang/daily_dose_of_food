import { describe, expect, it } from 'vitest';
import { publishReviewSchema, type PublishReview, type ReviewItemInput } from './schema.ts';

type FoodItem = Extract<ReviewItemInput, { itemType: 'food' }>;
type DrinkItem = Extract<ReviewItemInput, { itemType: 'drink' }>;

function foodItem(overrides: Partial<Omit<FoodItem, 'itemType'>> = {}): FoodItem {
	return {
		itemType: 'food',
		itemName: 'Fish amok',
		description: null,
		price: 7,
		taxPercent: 8,
		currencyCode: 'USD',
		individualRating: 4.5,
		isFavorite: false,
		isLeastFavorite: false,
		ratings: [],
		cuisineTypeId: null,
		foodTypeIds: [],
		portionSize: null,
		tasteNotes: null,
		...overrides
	};
}

function drinkItem(overrides: Partial<Omit<DrinkItem, 'itemType'>> = {}): DrinkItem {
	return {
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
		iceLevel: null,
		...overrides
	};
}

function payload(overrides: Partial<PublishReview> = {}): PublishReview {
	return {
		reviewId: '123e4567-e89b-12d3-a456-426614174000',
		reviewType: 'food',
		visitType: 'dine_in',
		mealType: 'lunch',
		visitedAt: '2026-01-01T12:00:00.000Z',
		place: { kind: 'existing', placeId: '123e4567-e89b-12d3-a456-426614174001' },
		title: null,
		description: null,
		visibility: 'public',
		isFavorite: false,
		items: [foodItem()],
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

describe('publishReviewSchema', () => {
	it('accepts a minimal valid food payload', () => {
		expect(publishReviewSchema.safeParse(payload()).success).toBe(true);
	});

	it('accepts a review with no ratings at all (only a place and an item name are required)', () => {
		const result = publishReviewSchema.safeParse(payload({ placeRatings: [] }));
		expect(result.success).toBe(true);
	});

	it('rejects a non-null mealType on a drink-only review', () => {
		const result = publishReviewSchema.safeParse(
			payload({ reviewType: 'drink', mealType: 'lunch', items: [drinkItem()] })
		);
		expect(result.success).toBe(false);
	});

	it('accepts a null mealType on a drink-only review', () => {
		const result = publishReviewSchema.safeParse(
			payload({ reviewType: 'drink', mealType: null, items: [drinkItem()] })
		);
		expect(result.success).toBe(true);
	});

	it('rejects a combined review without exactly one food and one drink item', () => {
		const result = publishReviewSchema.safeParse(
			payload({ reviewType: 'combined', items: [foodItem()] })
		);
		expect(result.success).toBe(false);
	});

	it('accepts a combined review with one food and one drink item', () => {
		const result = publishReviewSchema.safeParse(
			payload({ reviewType: 'combined', items: [foodItem(), drinkItem()] })
		);
		expect(result.success).toBe(true);
	});

	it('rejects a food review whose items include a drink', () => {
		const result = publishReviewSchema.safeParse(
			payload({ reviewType: 'food', items: [drinkItem()] })
		);
		expect(result.success).toBe(false);
	});

	it('rejects more than one cover photo', () => {
		const result = publishReviewSchema.safeParse(
			payload({
				photos: [
					{
						publicId: 'a',
						version: 1,
						signature: 's',
						format: 'jpg',
						width: 1,
						height: 1,
						bytes: 1,
						caption: null,
						isCover: true
					},
					{
						publicId: 'b',
						version: 1,
						signature: 's',
						format: 'jpg',
						width: 1,
						height: 1,
						bytes: 1,
						caption: null,
						isCover: true
					}
				]
			})
		);
		expect(result.success).toBe(false);
	});

	it('rejects a duplicate rating category among placeRatings', () => {
		const result = publishReviewSchema.safeParse(
			payload({
				placeRatings: [
					{
						ratingCategoryId: 3,
						ratingValue: 4,
						isApplicable: true,
						criteriaOptionIds: [],
						comment: null
					},
					{
						ratingCategoryId: 3,
						ratingValue: 2,
						isApplicable: true,
						criteriaOptionIds: [],
						comment: null
					}
				]
			})
		);
		expect(result.success).toBe(false);
	});

	it('rejects an item marked both favorite and least-favorite', () => {
		const result = publishReviewSchema.safeParse(
			payload({ items: [foodItem({ isFavorite: true, isLeastFavorite: true })] })
		);
		expect(result.success).toBe(false);
	});

	it('rejects zero items', () => {
		expect(publishReviewSchema.safeParse(payload({ items: [] })).success).toBe(false);
	});

	it('rejects more than two items', () => {
		const result = publishReviewSchema.safeParse(
			payload({ reviewType: 'combined', items: [foodItem(), drinkItem(), foodItem()] })
		);
		expect(result.success).toBe(false);
	});

	it('rejects a star rating that is not a multiple of 0.5', () => {
		const result = publishReviewSchema.safeParse(
			payload({
				placeRatings: [
					{
						ratingCategoryId: 3,
						ratingValue: 3.3,
						isApplicable: true,
						criteriaOptionIds: [],
						comment: null
					}
				]
			})
		);
		expect(result.success).toBe(false);
	});
});
