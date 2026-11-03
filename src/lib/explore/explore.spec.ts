import { describe, expect, it } from 'vitest';
import {
	activeCount,
	EMPTY_FILTERS,
	exploreUrl,
	type ExploreFilters,
	favoriteLabel,
	filtersToParams,
	parseFilters,
	QUICK_CHIPS,
	quickChipOn,
	removableChips,
	tileIcon,
	tileTint,
	toggleQuickChip,
	toggleValue
} from './explore.ts';

describe('tileTint', () => {
	it('is stable for an id and covers all three tints', () => {
		const ids = [
			'00000000-0000-4000-8000-000000000000',
			'00000000-0000-4000-8000-000000000001',
			'00000000-0000-4000-8000-000000000002'
		];
		const tints = ids.map(tileTint);
		expect(new Set(tints)).toEqual(new Set(['t1', 't2', 't3']));
		expect(ids.map(tileTint)).toEqual(tints);
	});

	it('does not throw on a malformed id', () => {
		expect(tileTint('not-a-uuid-zz')).toBe('t1');
	});
});

describe('tileIcon', () => {
	it.each([
		['Coffee', 'coffee'],
		['Tea', 'coffee'],
		['Milk tea', 'coffee'],
		['Juice', 'cup'],
		['Smoothie', 'cup'],
		['Soda', 'cup'],
		['Cocktail', 'cup'],
		['Dessert', 'cake'],
		['Pastry', 'cake'],
		['Noodles', 'bowl'],
		['Soup', 'bowl'],
		['Main course', 'dine'],
		[null, 'dine']
	] as const)('%s -> %s', (type, icon) => {
		expect(tileIcon(type)).toBe(icon);
	});
});

describe('favoriteLabel', () => {
	it('names the viewer on their own review', () => {
		expect(favoriteLabel(true, 'Mimi Doe')).toBe('YOUR FAVORITE');
	});

	it("uses the author's first name otherwise", () => {
		expect(favoriteLabel(false, 'Anna Doe')).toBe("ANNA'S FAVORITE");
		expect(favoriteLabel(false, '  Ben  Lim ')).toBe("BEN'S FAVORITE");
	});

	it('degrades to a plain label for a blank name', () => {
		expect(favoriteLabel(false, '  ')).toBe('FAVORITE');
	});
});

const f = (patch: Partial<ExploreFilters>): ExploreFilters => ({ ...EMPTY_FILTERS, ...patch });
const parse = (qs: string) => parseFilters(new URLSearchParams(qs));

describe('parseFilters / filtersToParams', () => {
	it('round-trips every section', () => {
		const all = f({
			sort: 'top',
			meals: ['breakfast', 'snack'],
			type: 'food',
			cuisines: ['french', 'khmer'],
			kinds: ['dessert', 'noodles'],
			maxPrice: 8,
			rating: 4,
			from: 'following',
			photos: true
		});
		expect(parse(filtersToParams(all).toString())).toEqual(all);
	});

	it('leaves every default out of the URL', () => {
		expect(filtersToParams(EMPTY_FILTERS).toString()).toBe('');
		expect(exploreUrl(EMPTY_FILTERS)).toBe('/explore');
	});

	it('drops junk instead of failing', () => {
		expect(
			parse(
				'sort=best&meal=brunch&type=both&cuisine=Khmer&cuisine=a%20b&kind=--&max=7&rating=6&from=me&photos=yes'
			)
		).toEqual(EMPTY_FILTERS);
	});

	it('dedupes lists', () => {
		expect(parse('meal=lunch&meal=lunch&cuisine=khmer&cuisine=khmer')).toEqual(
			f({ meals: ['lunch'], cuisines: ['khmer'] })
		);
	});

	it('makes the same URL whatever order the filters were picked in', () => {
		const a = toggleValue(toggleValue(EMPTY_FILTERS, 'meals', 'dinner'), 'meals', 'breakfast');
		const b = toggleValue(toggleValue(EMPTY_FILTERS, 'meals', 'breakfast'), 'meals', 'dinner');
		expect(exploreUrl(a)).toBe(exploreUrl(b));
		expect(exploreUrl(a)).toBe('/explore?meal=breakfast&meal=dinner');
	});
});

describe('exploreUrl', () => {
	it('carries the query, a non-default tab and the cursor after the filters', () => {
		expect(exploreUrl(f({ type: 'drink' }), { q: 'iced', tab: 'food', cursor: 'a_b' })).toBe(
			'/explore?type=drink&q=iced&tab=food&cursor=a_b'
		);
		expect(exploreUrl(EMPTY_FILTERS, { q: 'iced', tab: 'all' })).toBe('/explore?q=iced');
	});
});

describe('quick chips', () => {
	it('toggle on and off, several at once', () => {
		const [breakfast, , , drinks, desserts] = QUICK_CHIPS;
		let state = toggleQuickChip(EMPTY_FILTERS, breakfast);
		state = toggleQuickChip(state, drinks);
		state = toggleQuickChip(state, desserts);
		expect(state).toEqual(f({ meals: ['breakfast'], type: 'drink', kinds: ['dessert'] }));
		expect(QUICK_CHIPS.filter((c) => quickChipOn(state, c)).map((c) => c.label)).toEqual([
			'Breakfast',
			'Drinks',
			'Desserts'
		]);
		expect(toggleQuickChip(state, drinks).type).toBe('any');
	});

	it('read what the panel set', () => {
		const khmer = QUICK_CHIPS.find((c) => c.label === 'Khmer')!;
		expect(quickChipOn(f({ cuisines: ['french', 'khmer'] }), khmer)).toBe(true);
	});
});

describe('activeCount', () => {
	it('counts sections, not values, and ignores sort', () => {
		expect(activeCount(EMPTY_FILTERS)).toBe(0);
		expect(activeCount(f({ sort: 'liked' }))).toBe(0);
		expect(activeCount(f({ meals: ['breakfast', 'lunch'], maxPrice: 5, photos: true }))).toBe(3);
	});
});

describe('removableChips', () => {
	const nameOf = (slug: string) => slug.toUpperCase();

	it('is empty when only quick chips are on', () => {
		expect(
			removableChips(f({ meals: ['lunch'], type: 'drink', cuisines: ['khmer'] }), nameOf)
		).toEqual([]);
	});

	it('lists panel-only filters, each linking to the state without it', () => {
		const state = f({
			meals: ['lunch', 'snack'],
			type: 'food',
			cuisines: ['khmer', 'french'],
			maxPrice: 8,
			rating: 5,
			from: 'following',
			photos: true,
			sort: 'top'
		});
		const chips = removableChips(state, nameOf);
		expect(chips.map((c) => c.label)).toEqual([
			'Snack',
			'FRENCH',
			'Food only',
			'Up to $8',
			'5★ only',
			'People I follow',
			'Has photos',
			'Sorted by top rated'
		]);
		expect(chips[1].without.cuisines).toEqual(['khmer']);
		expect(chips[3].without).toEqual({ ...state, maxPrice: 0 });
	});

	it('reads a minimum rating below 5 as "and up"', () => {
		expect(removableChips(f({ rating: 4 }), nameOf)[0].label).toBe('4★ and up');
	});
});
