import { describe, expect, it } from 'vitest';
import {
	capDishes,
	dishChips,
	dishKey,
	filterPlaceReviews,
	PLACE_FILTERS,
	type PlaceReview,
	placeSummary,
	placeToggles
} from './place.ts';

let n = 0;
const r = (patch: Partial<PlaceReview>): PlaceReview => ({
	id: `r${++n}`,
	overall: 4,
	price: 3,
	kind: 'Coffee',
	dish: 'Iced Latte',
	followed: false,
	hasPhotos: false,
	likes: 0,
	publishedAt: '2026-11-01T00:00:00.000Z',
	...patch
});

describe('placeSummary', () => {
	it('averages, counts and ranges the prices', () => {
		const s = placeSummary([r({ overall: 5, price: 2.75 }), r({ overall: 3, price: 6.5 })]);
		expect(s.average).toBe(4);
		expect(s.count).toBe(2);
		expect(s.priceRange).toBe('$2.75–$6.50');
	});

	it('shows one price when they are equal, and ignores reviews without one', () => {
		expect(
			placeSummary([r({ price: 2.75 }), r({ price: 2.75 }), r({ price: null })]).priceRange
		).toBe('$2.75');
		expect(placeSummary([r({ price: null })]).priceRange).toBeNull();
	});

	it('says "Mostly" only for a kind over half of 2+ reviews', () => {
		expect(placeSummary([r({ kind: 'Coffee' })]).mostly).toBeNull();
		expect(
			placeSummary([r({ kind: 'Coffee' }), r({ kind: 'Coffee' }), r({ kind: 'Tea' })]).mostly
		).toBe('coffee');
		expect(placeSummary([r({ kind: 'Coffee' }), r({ kind: 'Tea' })]).mostly).toBeNull();
	});

	it('handles a place with no reviews', () => {
		expect(placeSummary([])).toEqual({ average: 0, count: 0, priceRange: null, mostly: null });
	});
});

describe('dishChips', () => {
	it('groups spellings, most reviewed first, ties to the higher average', () => {
		const chips = dishChips([
			r({ dish: 'Iced Latte', overall: 3 }),
			r({ dish: 'Croissant', overall: 5 }),
			r({ dish: 'iced  latté', overall: 3 }),
			r({ dish: 'Brownie', overall: 4 })
		]);
		expect(chips).toEqual([
			{ key: 'iced latte', label: 'Iced Latte', count: 2 },
			{ key: 'croissant', label: 'Croissant', count: 1 },
			{ key: 'brownie', label: 'Brownie', count: 1 }
		]);
		expect(dishKey(' Iced  Latté ')).toBe('iced latte');
	});
});

describe('placeToggles', () => {
	it('offers each toggle only when it would change something', () => {
		expect(placeToggles([r({}), r({})])).toEqual({ following: false, photos: false });
		expect(placeToggles([r({ hasPhotos: true }), r({ hasPhotos: true })]).photos).toBe(false);
		expect(placeToggles([r({ hasPhotos: true }), r({ followed: true })])).toEqual({
			following: true,
			photos: true
		});
	});
});

describe('filterPlaceReviews', () => {
	const a = r({ dish: 'Iced Latte', followed: true, likes: 5, overall: 3 });
	const b = r({ dish: 'Iced Latte', hasPhotos: true, likes: 9, overall: 5 });
	const c = r({ dish: 'Croissant', followed: true, hasPhotos: true, likes: 1, overall: 5 });
	const list = [a, b, c];

	it('ANDs the dish, follow and photo filters', () => {
		expect(
			filterPlaceReviews(list, { ...PLACE_FILTERS, dish: 'iced latte', following: true })
		).toEqual([a]);
		expect(filterPlaceReviews(list, { ...PLACE_FILTERS, following: true, photos: true })).toEqual([
			c
		]);
		expect(filterPlaceReviews(list, PLACE_FILTERS)).toEqual(list);
	});

	it('sorts by rating then likes, or by likes, without touching the input', () => {
		expect(filterPlaceReviews(list, { ...PLACE_FILTERS, sort: 'top' })).toEqual([b, c, a]);
		expect(filterPlaceReviews(list, { ...PLACE_FILTERS, sort: 'liked' })).toEqual([b, a, c]);
		expect(list).toEqual([a, b, c]);
	});
});

describe('capDishes', () => {
	const chips = Array.from({ length: 12 }, (_, i) => ({ key: `d${i}`, label: `D${i}`, count: 1 }));

	it('caps at 8 from 10 dishes up', () => {
		expect(capDishes(chips.slice(0, 9), null, false)).toMatchObject({ hidden: 0, capped: false });
		const capped = capDishes(chips, null, false);
		expect(capped.shown).toHaveLength(8);
		expect(capped.hidden).toBe(4);
	});

	it('keeps a selected dish past the cap visible, and shows everything when expanded', () => {
		const capped = capDishes(chips, 'd10', false);
		expect(capped.shown.map((c) => c.key)).toContain('d10');
		expect(capped.hidden).toBe(3);
		expect(capDishes(chips, null, true)).toMatchObject({ hidden: 0, capped: false });
	});
});
