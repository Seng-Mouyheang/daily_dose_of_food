import { describe, expect, it } from 'vitest';
import {
	aggregateCategoryRatings,
	cardViewFromDraft,
	splitTags,
	type DraftCardLookups
} from './card.ts';
import type { CategoryRatingDraft, ItemDraft, PhotoDraft } from './draft.svelte.ts';
import type { ReviewDraftSnapshot } from './payload.ts';

const AUTHOR = { displayName: 'Mimi Doe', avatarUrl: null };

/** Two place categories, one of which only applies to dine-in, so the stale-rating rule has
 *  something to drop. Ids match the ratings built below. */
const LOOKUPS: DraftCardLookups = {
	categories: [
		{
			id: 1,
			slug: 'service',
			name: 'Service',
			appliesToFood: false,
			appliesToDrink: false,
			appliesToPlace: true,
			appliesToDineIn: true,
			appliesToTakeaway: true,
			appliesToDelivery: true,
			positive: [{ id: 11, label: 'Attentive' }],
			negative: [{ id: 12, label: 'Slow' }]
		},
		{
			id: 2,
			slug: 'amenities',
			name: 'Amenities',
			appliesToFood: false,
			appliesToDrink: false,
			appliesToPlace: true,
			appliesToDineIn: true,
			appliesToTakeaway: false,
			appliesToDelivery: false,
			positive: [{ id: 21, label: 'Outlets' }],
			negative: [{ id: 22, label: 'Noisy' }]
		}
	],
	foodTypes: [{ id: 5, name: 'Dessert' }],
	drinkTypes: [{ id: 7, name: 'Coffee' }]
};

function rating(overrides: Partial<CategoryRatingDraft> = {}): CategoryRatingDraft {
	return {
		ratingCategoryId: 1,
		ratingValue: null,
		criteriaOptionIds: [],
		customCriteria: [],
		comment: null,
		...overrides
	};
}

function item(overrides: Partial<ItemDraft> = {}): ItemDraft {
	return {
		itemType: 'food',
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
		cuisineTypeOther: null,
		foodTypeIds: [],
		foodTypeOther: null,
		portionSize: null,
		tasteNotes: null,
		drinkTypeId: null,
		drinkTypeOther: null,
		sizeLabel: '',
		sugarLevelPercent: null,
		iceLevel: null,
		...overrides
	};
}

function photo(overrides: Partial<PhotoDraft> = {}): PhotoDraft {
	return {
		publicId: 'p1',
		version: 1,
		signature: 'sig',
		format: 'jpg',
		width: 100,
		height: 100,
		bytes: 1000,
		caption: null,
		isCover: false,
		previewUrl: 'https://example.test/p1.jpg',
		...overrides
	};
}

function draft(overrides: Partial<ReviewDraftSnapshot> = {}): ReviewDraftSnapshot {
	return {
		reviewId: 'r1',
		reviewType: 'dish',
		visitType: 'dine_in',
		mealType: 'breakfast',
		visitedAt: '2026-07-28',
		place: null,
		newPlaceName: '',
		dish: item(),
		drink: item({ itemType: 'drink' }),
		placeRatings: [],
		isFavorite: false,
		title: '',
		description: '',
		visibility: 'public',
		photos: [],
		...overrides
	};
}

describe('cardViewFromDraft', () => {
	it('marks itself as a preview: no href and no timeAgo', () => {
		const view = cardViewFromDraft(draft(), LOOKUPS, AUTHOR);
		expect(view.href).toBeNull();
		expect(view.timeAgo).toBeNull();
	});

	it('reports no photos as an empty array, so the card can omit the photo block', () => {
		expect(cardViewFromDraft(draft(), LOOKUPS, AUTHOR).photos).toEqual([]);
	});

	it('puts the cover photo first regardless of its position in the draft', () => {
		const view = cardViewFromDraft(
			draft({
				photos: [
					photo({ publicId: 'a', previewUrl: 'a.jpg' }),
					photo({ publicId: 'b', previewUrl: 'b.jpg', isCover: true })
				]
			}),
			LOOKUPS,
			AUTHOR
		);
		expect(view.photos.map((p) => p.url)).toEqual(['b.jpg', 'a.jpg']);
	});

	it('averages every rating that is still in play', () => {
		const view = cardViewFromDraft(
			draft({
				placeRatings: [
					rating({ ratingCategoryId: 1, ratingValue: 5 }),
					rating({ ratingCategoryId: 2, ratingValue: 3 })
				]
			}),
			LOOKUPS,
			AUTHOR
		);
		expect(view.overallRating).toBe(4);
	});

	it('leaves the rating null when nothing has been rated', () => {
		const view = cardViewFromDraft(
			draft({ placeRatings: [rating({ criteriaOptionIds: [11] })] }),
			LOOKUPS,
			AUTHOR
		);
		expect(view.overallRating).toBeNull();
	});

	it('drops a rating for a category the current visit type no longer applies to', () => {
		// Amenities (id 2) is dine-in only, so switching to takeaway must leave its stale 1-star
		// out of both the average and the tag list — the server drops it on publish too.
		const stale = draft({
			visitType: 'takeaway',
			placeRatings: [
				rating({ ratingCategoryId: 1, ratingValue: 5 }),
				rating({ ratingCategoryId: 2, ratingValue: 1, criteriaOptionIds: [22] })
			]
		});
		const view = cardViewFromDraft(stale, LOOKUPS, AUTHOR);
		expect(view.overallRating).toBe(5);
		expect(view.tags).toEqual([]);
	});

	it('drops the drink entirely on a dish-only review', () => {
		const view = cardViewFromDraft(
			draft({
				reviewType: 'dish',
				dish: item({ itemName: 'Mille-feuille', price: '6.50' }),
				drink: item({
					itemType: 'drink',
					itemName: 'Latte',
					price: '2.75',
					ratings: [rating({ ratingCategoryId: 1, ratingValue: 1 })]
				})
			}),
			LOOKUPS,
			AUTHOR
		);
		expect(view.price).toBe(6.5);
		expect(view.overallRating).toBeNull();
	});

	it('sums both prices on a combined review', () => {
		const view = cardViewFromDraft(
			draft({
				reviewType: 'both',
				dish: item({ itemName: 'Mille-feuille', price: '6.50' }),
				drink: item({ itemType: 'drink', itemName: 'Latte', price: '2,75' })
			}),
			LOOKUPS,
			AUTHOR
		);
		expect(view.price).toBe(9.25);
	});

	it('leaves the price null when no item has a usable one', () => {
		const view = cardViewFromDraft(draft({ dish: item({ price: '' }) }), LOOKUPS, AUTHOR);
		expect(view.price).toBeNull();
	});

	it('splits tags by sentiment and includes ones the person typed themselves', () => {
		const view = cardViewFromDraft(
			draft({
				placeRatings: [
					rating({
						ratingCategoryId: 1,
						criteriaOptionIds: [11, 12],
						customCriteria: [{ label: 'Great playlist', sentiment: 'positive' }]
					})
				]
			}),
			LOOKUPS,
			AUTHOR
		);
		expect(view.tags).toEqual([
			{ label: 'Attentive', sentiment: 'positive' },
			{ label: 'Slow', sentiment: 'negative' },
			{ label: 'Great playlist', sentiment: 'positive' }
		]);
	});

	it('prefers the dish name and food type on a combined review', () => {
		const view = cardViewFromDraft(
			draft({
				reviewType: 'both',
				dish: item({ itemName: 'Mille-feuille', foodTypeIds: [5] }),
				drink: item({ itemType: 'drink', itemName: 'Latte', drinkTypeId: 7 })
			}),
			LOOKUPS,
			AUTHOR
		);
		expect(view.title).toBe('Mille-feuille');
		expect(view.itemTypeLabel).toBe('Dessert');
	});

	it('uses the drink name and drink type on a drink-only review', () => {
		const view = cardViewFromDraft(
			draft({
				reviewType: 'beverage',
				drink: item({ itemType: 'drink', itemName: 'Iced latte', drinkTypeId: 7 })
			}),
			LOOKUPS,
			AUTHOR
		);
		expect(view.title).toBe('Iced latte');
		expect(view.itemTypeLabel).toBe('Coffee');
	});

	it('falls back to the other item name when the preferred one is still blank', () => {
		const view = cardViewFromDraft(
			draft({ reviewType: 'both', drink: item({ itemType: 'drink', itemName: 'Latte' }) }),
			LOOKUPS,
			AUTHOR
		);
		expect(view.title).toBe('Latte');
	});

	it('falls back to a placeholder title when nothing is named yet', () => {
		expect(cardViewFromDraft(draft(), LOOKUPS, AUTHOR).title).toBe('Untitled review');
	});

	it('shows a manually typed place name, and a prompt when there is no place at all', () => {
		expect(
			cardViewFromDraft(draft({ newPlaceName: '  Stall 12  ' }), LOOKUPS, AUTHOR).placeName
		).toBe('Stall 12');
		expect(cardViewFromDraft(draft(), LOOKUPS, AUTHOR).placeName).toBe('Choose a place');
	});

	it('normalizes a blank description to null', () => {
		expect(
			cardViewFromDraft(draft({ description: '   ' }), LOOKUPS, AUTHOR).description
		).toBeNull();
	});
});

describe('aggregateCategoryRatings', () => {
	const rating = (slug: string, name: string, value: number | null) => ({
		categoryId: 1,
		slug,
		name,
		ratingValue: value
	});

	it('averages the scores a category was given more than once', () => {
		// Food quality is rated per item, so a dish-and-drink review carries two of them.
		expect(
			aggregateCategoryRatings([
				rating('food-quality', 'Food quality', 5),
				rating('food-quality', 'Food quality', 4)
			])
		).toEqual([{ slug: 'food-quality', name: 'Food quality', value: 4.5 }]);
	});

	it('drops a category nobody scored, rather than drawing an empty bar', () => {
		expect(
			aggregateCategoryRatings([rating('price', 'Price', null), rating('service', 'Service', 3)])
		).toEqual([{ slug: 'service', name: 'Service', value: 3 }]);
	});

	it('keeps the order the rows arrived in', () => {
		expect(
			aggregateCategoryRatings([rating('service', 'Service', 3), rating('price', 'Price', 2)]).map(
				(r) => r.slug
			)
		).toEqual(['service', 'price']);
	});
});

describe('splitTags', () => {
	it('separates praise from complaints', () => {
		const { positive, negative } = splitTags([
			{ label: 'Fresh', sentiment: 'positive' },
			{ label: 'Too salty', sentiment: 'negative' },
			{ label: 'Fast', sentiment: 'positive' }
		]);
		expect(positive.map((t) => t.label)).toEqual(['Fresh', 'Fast']);
		expect(negative.map((t) => t.label)).toEqual(['Too salty']);
	});
});
