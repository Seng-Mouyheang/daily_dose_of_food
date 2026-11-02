/**
 * Explore's pure rules: which filter chips exist and how they travel in the URL, plus the three
 * things a grid card derives from a review rather than stores — the tint of a photo-free tile,
 * the watermark icon behind its quote, and the Favorite badge's label. Pure, so it is
 * unit-tested without a request or a DOM.
 */

export type ExploreFilter =
	'all' | 'breakfast' | 'lunch' | 'dinner' | 'drinks' | 'desserts' | 'khmer';

export const EXPLORE_FILTERS: { value: ExploreFilter; label: string }[] = [
	{ value: 'all', label: 'All' },
	{ value: 'breakfast', label: 'Breakfast' },
	{ value: 'lunch', label: 'Lunch' },
	{ value: 'dinner', label: 'Dinner' },
	{ value: 'drinks', label: 'Drinks' },
	{ value: 'desserts', label: 'Desserts' },
	{ value: 'khmer', label: 'Khmer' }
];

/** Anything unknown is "all": a hand-edited `?filter=` shows the whole grid, never a 500. */
export function parseExploreFilter(raw: string | null): ExploreFilter {
	return EXPLORE_FILTERS.find((f) => f.value === raw)?.value ?? 'all';
}

/** `cursor` arrives already encoded (the server hands it over that way), so this stays on the
 *  client side of the server-only import guard. */
export function exploreHref(filter: ExploreFilter, cursor: string | null = null): string {
	const params = new URLSearchParams();
	if (filter !== 'all') params.set('filter', filter);
	if (cursor) params.set('cursor', cursor);
	const qs = params.toString();
	return qs ? `/explore?${qs}` : '/explore';
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
