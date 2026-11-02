/**
 * What the Log a visit form suggests: places you go to most ("Your regulars"), what you usually
 * have at one ("Your usual at X"), what you had lately, and matches while typing. All ranked
 * from your own past logs, so a place typed once as text is a regular from then on.
 * Pure and unit-tested; the server only fetches the history.
 */

export interface PlaceRow {
	place: string;
	placeId: string | null;
	address: string | null;
}

export interface PlaceSuggestion {
	name: string;
	placeId: string | null;
	address: string | null;
	visits: number;
}

export interface HistoryRow {
	title: string;
	itemType: 'food' | 'drink';
	foodTypeId: number | null;
	drinkTypeId: number | null;
	cuisineTypeId: number | null;
	/** Dish type or drink type name */
	kind: string | null;
	cuisine: string | null;
	place: string;
	qty: number;
	/** Line total paid, tax included */
	price: number;
	taxPercent: number | null;
}

export interface ItemSuggestion extends Omit<HistoryRow, 'place' | 'qty' | 'price'> {
	/** Price of one before tax, as last paid */
	priceEach: number;
	/** The tax it carried, so a reused price isn't taxed twice */
	taxPercent: number | null;
	uses: number;
}

const norm = (s: string) => s.trim().toLowerCase();

/** One entry per place (names compare case-insensitively), most visited first. */
export function rankPlaces(rows: PlaceRow[]): PlaceSuggestion[] {
	const byName = new Map<string, PlaceSuggestion>();
	for (const r of rows) {
		const k = norm(r.place);
		const cur = byName.get(k);
		if (cur) {
			cur.visits++;
			cur.placeId ??= r.placeId;
			cur.address ??= r.address;
		} else {
			byName.set(k, { name: r.place.trim(), placeId: r.placeId, address: r.address, visits: 1 });
		}
	}
	return [...byName.values()].sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name));
}

/** Matches on name or address, names that start with the query first. */
export function searchPlaces(places: PlaceSuggestion[], q: string, limit = 5): PlaceSuggestion[] {
	const needle = norm(q);
	if (!needle) return [];
	const hits = places.filter((p) => norm(`${p.name} ${p.address ?? ''}`).includes(needle));
	const starts = (p: PlaceSuggestion) => (norm(p.name).startsWith(needle) ? 0 : 1);
	return hits.sort((a, b) => starts(a) - starts(b)).slice(0, limit);
}

/** Groups history (newest first) into one suggestion per item, in order of first appearance.
 *  The newest row supplies the price and lookup ids, so an item's last price wins. */
function group(rows: HistoryRow[]): ItemSuggestion[] {
	const byTitle = new Map<string, ItemSuggestion>();
	for (const r of rows) {
		const k = norm(r.title);
		const cur = byTitle.get(k);
		if (cur) cur.uses++;
		else {
			const { title, itemType, foodTypeId, drinkTypeId, cuisineTypeId, kind, cuisine } = r;
			byTitle.set(k, {
				title,
				itemType,
				foodTypeId,
				drinkTypeId,
				cuisineTypeId,
				kind,
				cuisine,
				priceEach: Math.round((r.price / r.qty / (1 + (r.taxPercent ?? 0) / 100)) * 100) / 100,
				taxPercent: r.taxPercent,
				uses: 1
			});
		}
	}
	return [...byTitle.values()];
}

/** The items you log most at one place, each at the price you last paid there. */
export function usualAt(history: HistoryRow[], place: string, limit = 5): ItemSuggestion[] {
	const here = history.filter((r) => norm(r.place) === norm(place));
	return group(here)
		.sort((a, b) => b.uses - a.uses)
		.slice(0, limit);
}

/** The latest distinct items, for when no place is picked yet. */
export const recentItems = (history: HistoryRow[], limit = 6) => group(history).slice(0, limit);

/** Matches on the item name, names that start with the query first. */
export function searchItems(history: HistoryRow[], q: string, limit = 5): ItemSuggestion[] {
	const needle = norm(q);
	if (!needle) return [];
	const starts = (s: ItemSuggestion) => (norm(s.title).startsWith(needle) ? 0 : 1);
	return group(history)
		.filter((s) => norm(s.title).includes(needle))
		.sort((a, b) => starts(a) - starts(b))
		.slice(0, limit);
}
