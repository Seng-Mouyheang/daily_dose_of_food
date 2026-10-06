import { describe, expect, it } from 'vitest';
import {
	buildPublishPayload,
	PLACEHOLDER_PLACE_LOCATION,
	type ReviewDraftSnapshot
} from './payload.ts';
import type { ItemDraft } from './draft.svelte.ts';

function emptyItem(itemType: 'food' | 'drink'): ItemDraft {
	return {
		itemType,
		itemName: '',
		description: null,
		price: '',
		taxPercent: '',
		currencyCode: 'USD',
		individualRating: null,
		isFavorite: false,
		isLeastFavorite: false,
		ratings: [],
		cuisineTypeId: null,
		foodTypeIds: [],
		portionSize: null,
		tasteNotes: null,
		drinkTypeId: null,
		sizeLabel: '',
		sugarLevelPercent: 50,
		iceLevel: null
	};
}

function snapshot(overrides: Partial<ReviewDraftSnapshot> = {}): ReviewDraftSnapshot {
	return {
		reviewId: '123e4567-e89b-12d3-a456-426614174000',
		reviewType: 'dish',
		visitType: 'dine_in',
		mealType: 'lunch',
		visitedAt: '2026-01-01',
		place: { id: 'place-1', name: 'Malis', addressLine1: null, city: null, distanceMeters: null },
		newPlaceName: '',
		dish: { ...emptyItem('food'), itemName: 'Fish amok', price: '7.5' },
		drink: emptyItem('drink'),
		placeRatings: [],
		isFavorite: false,
		title: '',
		description: '',
		visibility: 'public',
		photos: [],
		...overrides
	};
}

describe('buildPublishPayload', () => {
	it('maps a dish-only review to reviewType food with one item', () => {
		const payload = buildPublishPayload(snapshot());
		expect(payload.reviewType).toBe('food');
		expect(payload.items).toHaveLength(1);
		expect(payload.items[0]).toMatchObject({ itemType: 'food', itemName: 'Fish amok', price: 7.5 });
	});

	it('drops mealType for a beverage-only review', () => {
		const payload = buildPublishPayload(
			snapshot({ reviewType: 'beverage', drink: { ...emptyItem('drink'), itemName: 'Iced latte' } })
		);
		expect(payload.reviewType).toBe('drink');
		expect(payload.mealType).toBeNull();
		expect(payload.items).toHaveLength(1);
		expect(payload.items[0]?.itemType).toBe('drink');
	});

	it('keeps mealType and emits both items for "both"', () => {
		const payload = buildPublishPayload(
			snapshot({
				reviewType: 'both',
				drink: { ...emptyItem('drink'), itemName: 'Iced latte' }
			})
		);
		expect(payload.reviewType).toBe('combined');
		expect(payload.mealType).toBe('lunch');
		expect(payload.items).toHaveLength(2);
	});

	it('uses the existing place id when one is selected', () => {
		const payload = buildPublishPayload(snapshot());
		expect(payload.place).toEqual({ kind: 'existing', placeId: 'place-1' });
	});

	it('falls back to a new place at the placeholder location when none is selected', () => {
		const payload = buildPublishPayload(snapshot({ place: null, newPlaceName: 'My Hidden Spot' }));
		expect(payload.place).toMatchObject({
			kind: 'new',
			name: 'My Hidden Spot',
			lat: PLACEHOLDER_PLACE_LOCATION.lat,
			lng: PLACEHOLDER_PLACE_LOCATION.lng,
			countryCode: 'KH'
		});
	});

	it('drops a rating the person never touched', () => {
		const payload = buildPublishPayload(
			snapshot({
				placeRatings: [
					{ ratingCategoryId: 3, ratingValue: null, criteriaOptionIds: [], comment: null },
					{ ratingCategoryId: 4, ratingValue: 4, criteriaOptionIds: [], comment: null }
				]
			})
		);
		expect(payload.placeRatings.map((r) => r.ratingCategoryId)).toEqual([4]);
	});

	it('keeps a rating with only tags and no stars', () => {
		const payload = buildPublishPayload(
			snapshot({
				placeRatings: [
					{ ratingCategoryId: 3, ratingValue: null, criteriaOptionIds: [12], comment: null }
				]
			})
		);
		expect(payload.placeRatings).toHaveLength(1);
	});

	it('parses a blank price/tax as null rather than 0', () => {
		const payload = buildPublishPayload(
			snapshot({ dish: { ...emptyItem('food'), itemName: 'Fish amok', price: '', taxPercent: '' } })
		);
		const item = payload.items[0];
		expect(item?.itemType === 'food' && item.price).toBeNull();
		expect(item && 'taxPercent' in item && item.taxPercent).toBeNull();
	});

	it('marks the first photo as cover when none was explicitly chosen', () => {
		const payload = buildPublishPayload(
			snapshot({
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
						isCover: false,
						previewUrl: ''
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
						isCover: false,
						previewUrl: ''
					}
				]
			})
		);
		expect(payload.photos.map((p) => p.isCover)).toEqual([true, false]);
	});

	it('respects an explicitly chosen cover photo instead of defaulting to the first', () => {
		const payload = buildPublishPayload(
			snapshot({
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
						isCover: false,
						previewUrl: ''
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
						isCover: true,
						previewUrl: ''
					}
				]
			})
		);
		expect(payload.photos.map((p) => p.isCover)).toEqual([false, true]);
	});
});
