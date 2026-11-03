/**
 * Explore's pure rules: the filter state and how it travels in the URL, plus the three
 * things a grid card derives from a review rather than stores — the tint of a photo-free tile,
 * the watermark icon behind its quote, and the Favorite badge's label. Pure, so it is
 * unit-tested without a request or a DOM.
 */

/* ------------------------------------ filter state ------------------------------------ */

/* One filter state behind the quick chips, the removable chips and the Filters panel, so they
 * always agree. It lives in the URL: the server runs it as SQL (paging stays correct) and every
 * filtered view can be linked to. OR inside a section, AND across sections; an empty section is
 * no limit. Cuisines and kinds travel as lookup-table slugs, so renaming a type doesn't break a
 * saved link. */

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type ExploreSort = 'new' | 'top' | 'liked';
export type FoodOrDrink = 'any' | 'food' | 'drink';
export type MaxPrice = 0 | 3 | 5 | 8 | 12;
export type MinRating = 0 | 3 | 4 | 5;

export interface ExploreFilters {
	sort: ExploreSort;
	meals: Meal[];
	type: FoodOrDrink;
	cuisines: string[];
	kinds: string[];
	/** 0 is any price. */
	maxPrice: MaxPrice;
	/** Minimum overall rating; 0 is any, 5 is 5★ only. */
	rating: MinRating;
	from: 'all' | 'following';
	photos: boolean;
}

export const EMPTY_FILTERS: ExploreFilters = {
	sort: 'new',
	meals: [],
	type: 'any',
	cuisines: [],
	kinds: [],
	maxPrice: 0,
	rating: 0,
	from: 'all',
	photos: false
};

export const MEALS: { value: Meal; label: string }[] = [
	{ value: 'breakfast', label: 'Breakfast' },
	{ value: 'lunch', label: 'Lunch' },
	{ value: 'dinner', label: 'Dinner' },
	{ value: 'snack', label: 'Snack' }
];

export const SORTS: { value: ExploreSort; label: string }[] = [
	{ value: 'new', label: 'Newest' },
	{ value: 'top', label: 'Top rated' },
	{ value: 'liked', label: 'Most liked' }
];

const PRICES: MaxPrice[] = [3, 5, 8, 12];
const RATINGS: MinRating[] = [3, 4, 5];
// Slugs are lowercase words joined by dashes; anything else in a hand-edited URL is dropped.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function priceLabel(max: MaxPrice): string {
	return max ? `Up to $${max}` : 'Any';
}

export function ratingLabel(min: MinRating): string {
	if (!min) return 'Any';
	return min === 5 ? '5★ only' : `${min}★ and up`;
}

function pick<T extends string | number>(
	allowed: readonly T[],
	raw: string | null,
	fallback: T
): T {
	return allowed.find((v) => String(v) === raw) ?? fallback;
}

function uniqueSlugs(raw: string[]): string[] {
	return [...new Set(raw.filter((v) => SLUG.test(v)))].sort().slice(0, 20);
}

/** Reads the filters from a URL. Anything unknown is dropped rather than rejected: a hand-edited
 *  link shows a wider grid, never a 500. */
export function parseFilters(params: URLSearchParams): ExploreFilters {
	const meals = params.getAll('meal');
	return {
		sort: pick(['new', 'top', 'liked'], params.get('sort'), 'new'),
		meals: MEALS.map((m) => m.value).filter((m) => meals.includes(m)),
		type: pick(['any', 'food', 'drink'], params.get('type'), 'any'),
		cuisines: uniqueSlugs(params.getAll('cuisine')),
		kinds: uniqueSlugs(params.getAll('kind')),
		maxPrice: pick([0, ...PRICES], params.get('max'), 0),
		rating: pick([0, ...RATINGS], params.get('rating'), 0),
		from: params.get('from') === 'following' ? 'following' : 'all',
		photos: params.get('photos') === '1'
	};
}

/** The URL form of `filters`, leaving out every default. Lists come out in a fixed order, so the
 *  same filters always make the same URL whichever control set them. */
export function filtersToParams(filters: ExploreFilters): URLSearchParams {
	const params = new URLSearchParams();
	if (filters.sort !== 'new') params.set('sort', filters.sort);
	for (const m of MEALS) if (filters.meals.includes(m.value)) params.append('meal', m.value);
	if (filters.type !== 'any') params.set('type', filters.type);
	for (const c of [...filters.cuisines].sort()) params.append('cuisine', c);
	for (const k of [...filters.kinds].sort()) params.append('kind', k);
	if (filters.maxPrice) params.set('max', String(filters.maxPrice));
	if (filters.rating) params.set('rating', String(filters.rating));
	if (filters.from === 'following') params.set('from', 'following');
	if (filters.photos) params.set('photos', '1');
	return params;
}

/** An Explore link: the filters, plus the search query, results tab and page when there are
 *  any. `cursor` arrives already encoded (the server hands it over that way). */
export function exploreUrl(
	filters: ExploreFilters,
	extra: { q?: string; tab?: string; cursor?: string | null } = {}
): string {
	const params = filtersToParams(filters);
	if (extra.q) params.set('q', extra.q);
	if (extra.tab && extra.tab !== 'all') params.set('tab', extra.tab);
	if (extra.cursor) params.set('cursor', extra.cursor);
	const qs = params.toString();
	return qs ? `/explore?${qs}` : '/explore';
}

type ListKey = 'meals' | 'cuisines' | 'kinds';

/** Adds `value` to one of the multi-select sections, or takes it out if it is already there. */
export function toggleValue<K extends ListKey>(
	filters: ExploreFilters,
	key: K,
	value: ExploreFilters[K][number]
): ExploreFilters {
	const list = filters[key] as string[];
	return {
		...filters,
		[key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
	};
}

export type QuickChip =
	{ label: string; key: ListKey; value: string } | { label: string; key: 'type'; value: 'drink' };

/** Shortcuts into the same state as the panel. Several can be on at once; none on is everything,
 *  so there is no "All". */
export const QUICK_CHIPS: QuickChip[] = [
	{ label: 'Breakfast', key: 'meals', value: 'breakfast' },
	{ label: 'Lunch', key: 'meals', value: 'lunch' },
	{ label: 'Dinner', key: 'meals', value: 'dinner' },
	{ label: 'Drinks', key: 'type', value: 'drink' },
	{ label: 'Desserts', key: 'kinds', value: 'dessert' },
	{ label: 'Khmer', key: 'cuisines', value: 'khmer' }
];

export function quickChipOn(filters: ExploreFilters, chip: QuickChip): boolean {
	return chip.key === 'type'
		? filters.type === chip.value
		: (filters[chip.key] as string[]).includes(chip.value);
}

export function toggleQuickChip(filters: ExploreFilters, chip: QuickChip): ExploreFilters {
	if (chip.key === 'type') {
		return { ...filters, type: filters.type === chip.value ? 'any' : chip.value };
	}
	return toggleValue(filters, chip.key, chip.value as never);
}

/** The Filters button's badge: how many sections are on. Sort isn't counted — it changes the
 *  order, not what you see. */
export function activeCount(f: ExploreFilters): number {
	return [
		f.meals.length > 0,
		f.type !== 'any',
		f.cuisines.length > 0,
		f.kinds.length > 0,
		f.maxPrice > 0,
		f.rating > 0,
		f.from !== 'all',
		f.photos
	].filter(Boolean).length;
}

export interface RemovableChip {
	label: string;
	/** The filters with this one taken off: the chip's link. */
	without: ExploreFilters;
}

/** What the panel set that no quick chip shows, so it can be seen and dropped from under the row.
 *  `nameOf` turns a cuisine or kind slug into its display name (the panel's facet list has them). */
export function removableChips(
	f: ExploreFilters,
	nameOf: (slug: string) => string
): RemovableChip[] {
	const quick = (key: ListKey, value: string) =>
		QUICK_CHIPS.some((c) => c.key === key && c.value === value);
	const chips: RemovableChip[] = [];
	for (const key of ['meals', 'cuisines', 'kinds'] as const) {
		for (const value of f[key] as string[]) {
			if (quick(key, value)) continue;
			const label =
				key === 'meals' ? (MEALS.find((m) => m.value === value)?.label ?? value) : nameOf(value);
			chips.push({ label, without: toggleValue(f, key, value as never) });
		}
	}
	if (f.type === 'food') chips.push({ label: 'Food only', without: { ...f, type: 'any' } });
	if (f.maxPrice) chips.push({ label: priceLabel(f.maxPrice), without: { ...f, maxPrice: 0 } });
	if (f.rating) chips.push({ label: ratingLabel(f.rating), without: { ...f, rating: 0 } });
	if (f.from === 'following') {
		chips.push({ label: 'People I follow', without: { ...f, from: 'all' } });
	}
	if (f.photos) chips.push({ label: 'Has photos', without: { ...f, photos: false } });
	if (f.sort !== 'new') {
		const sort = SORTS.find((s) => s.value === f.sort)?.label.toLowerCase();
		chips.push({ label: `Sorted by ${sort}`, without: { ...f, sort: 'new' } });
	}
	return chips;
}

export type TileTint = 't1' | 't2' | 't3';

/** The tint of a photo-free tile: accent-soft, good-soft or sunken. Taken from the review id
 *  rather than the card's position, so a card keeps its tint when the grid is filtered or paged
 *  (the filter and the paging both happen on the server, where the unfiltered position is not
 *  known). A uuid's last byte is uniformly random, so the three tints come out evenly. */
export function tileTint(reviewId: string): TileTint {
	const byte = parseInt(reviewId.replace(/-/g, '').slice(-2), 16);
	return (['t1', 't2', 't3'] as const)[(Number.isNaN(byte) ? 0 : byte) % 3];
}

export type TileIcon = 'coffee' | 'cup' | 'cake' | 'bowl' | 'dine';

/** What was ordered, at a glance, for the watermark: `typeLabel` is the primary item's food or
 *  drink type. Anything not named here (and a review with no type) is the fork and knife. */
export function tileIcon(typeLabel: string | null): TileIcon {
	switch (typeLabel) {
		case 'Coffee':
		case 'Tea':
		case 'Milk tea':
			return 'coffee';
		case 'Juice':
		case 'Smoothie':
		case 'Soda':
		case 'Cocktail':
			return 'cup';
		case 'Dessert':
		case 'Pastry':
			return 'cake';
		case 'Noodles':
		case 'Soup':
			return 'bowl';
		default:
			return 'dine';
	}
}

/** Whose favorite it is, so the badge can't be read as "you saved this". */
export function favoriteLabel(isOwn: boolean, displayName: string): string {
	if (isOwn) return 'YOUR FAVORITE';
	const first = displayName.trim().split(/\s+/)[0];
	return first ? `${first.toUpperCase()}'S FAVORITE` : 'FAVORITE';
}
