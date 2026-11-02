import { describe, expect, it } from 'vitest';
import {
	EXPLORE_FILTERS,
	exploreHref,
	favoriteLabel,
	parseExploreFilter,
	tileIcon,
	tileTint
} from './explore.ts';

describe('parseExploreFilter', () => {
	it('accepts every chip value', () => {
		for (const { value } of EXPLORE_FILTERS) expect(parseExploreFilter(value)).toBe(value);
	});

	it('falls back to all for anything else', () => {
		expect(parseExploreFilter(null)).toBe('all');
		expect(parseExploreFilter('')).toBe('all');
		expect(parseExploreFilter('Desserts')).toBe('all');
		expect(parseExploreFilter('pizza')).toBe('all');
	});
});

describe('exploreHref', () => {
	it('leaves the default filter out of the URL', () => {
		expect(exploreHref('all')).toBe('/explore');
	});

	it('carries the filter and the cursor', () => {
		expect(exploreHref('desserts')).toBe('/explore?filter=desserts');
		expect(exploreHref('all', 'a_b')).toBe('/explore?cursor=a_b');
		expect(exploreHref('khmer', '2026-11-01T00:00:00.000Z_x')).toBe(
			'/explore?filter=khmer&cursor=2026-11-01T00%3A00%3A00.000Z_x'
		);
	});
});

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
