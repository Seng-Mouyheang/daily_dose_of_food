/**
 * The place page's pure rules: the header card's stats, the "What people order" chips, and the
 * filters and sort over the place's reviews. All of it runs on the client over every public
 * review at the place (a handful), so the grid updates the moment a chip is tapped.
 *
 * Works on a flattened `PlaceReview` rather than the full feed review, so the rules are tested
 * with plain objects; `toPlaceReview` is the one adapter.
 */
import { primaryItem, reviewTitle, totalBeforeTax, type FeedReview } from '#lib/review/card.ts';
import type { ExploreSort } from './explore.ts';
import { fold } from './search.ts';

export interface PlaceReview {
	id: string;
	overall: number;
	/** Items' total before tax; null when none has a price. */
	price: number | null;
	/** The primary item's dish or drink type ("Coffee", "Main course"). */
	kind: string | null;
	/** What was ordered, as written on the card. */
	dish: string;
	/** By someone the viewer follows (never the viewer). */
	followed: boolean;
	hasPhotos: boolean;
	likes: number;
	/** ISO; newest first is the default order. */
	publishedAt: string;
}

export function toPlaceReview(review: FeedReview & { isOwn: boolean }): PlaceReview {
	return {
		id: review.id,
		overall: review.overallRating,
		price: totalBeforeTax(review.items),
		kind: primaryItem(review.items)?.typeLabel ?? null,
		dish: reviewTitle(review),
		followed: review.viewerFollowsAuthor && !review.isOwn,
		hasPhotos: review.photos.length > 0,
		likes: review.likeCount,
		publishedAt: review.publishedAt ?? ''
	};
}

const money = (n: number) => `$${n.toFixed(2)}`;

export interface PlaceSummary {
	average: number;
	count: number;
	/** "$2.75–$6.50", one price when they're all equal, null when no review has a price. */
	priceRange: string | null;
	/** "coffee": the kind more than half the reviews are, from 2 reviews up; otherwise null. */
	mostly: string | null;
}

export function placeSummary(list: PlaceReview[]): PlaceSummary {
	const count = list.length;
	const average = count ? list.reduce((t, r) => t + r.overall, 0) / count : 0;

	const prices = list.flatMap((r) => (r.price !== null && r.price > 0 ? [r.price] : []));
	const lo = Math.min(...prices);
	const hi = Math.max(...prices);
	const priceRange = !prices.length ? null : lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;

	let mostly: string | null = null;
	if (count >= 2) {
		const kinds = new Map<string, number>();
		for (const r of list) if (r.kind) kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + 1);
		const top = [...kinds].find(([, n]) => n > count / 2);
		mostly = top ? top[0].toLowerCase() : null;
	}

	return { average, count, priceRange, mostly };
}

/** Free-text names group when they only differ in case, accents or spacing ("Iced latte" and
 *  "iced  Latté" are one chip). */
export function dishKey(name: string): string {
	return fold(name).trim().replace(/\s+/g, ' ');
}

export interface DishChip {
	key: string;
	/** The spelling of its newest review. */
	label: string;
	count: number;
}

/** One chip per dish, most reviewed first, ties to the higher average. `list` is newest first. */
export function dishChips(list: PlaceReview[]): DishChip[] {
	const dishes = new Map<string, DishChip & { sum: number }>();
	for (const r of list) {
		const key = dishKey(r.dish);
		const d = dishes.get(key);
		if (d) {
			d.count++;
			d.sum += r.overall;
		} else {
			dishes.set(key, { key, label: r.dish, count: 1, sum: r.overall });
		}
	}
	return [...dishes.values()]
		.sort((a, b) => b.count - a.count || b.sum / b.count - a.sum / a.count)
		.map(({ key, label, count }) => ({ key, label, count }));
}

export interface PlaceFilters {
	sort: ExploreSort;
	/** A `dishKey`; single select. */
	dish: string | null;
	following: boolean;
	photos: boolean;
}

export const PLACE_FILTERS: PlaceFilters = {
	sort: 'new',
	dish: null,
	following: false,
	photos: false
};

/** The toggles show only when they would change something: People I follow when someone you
 *  follow reviewed here, Has photos when some reviews have photos and some don't. */
export function placeToggles(list: PlaceReview[]): { following: boolean; photos: boolean } {
	const withPhotos = list.filter((r) => r.hasPhotos).length;
	return {
		following: list.some((r) => r.followed),
		photos: withPhotos > 0 && withPhotos < list.length
	};
}

/** Every active filter must hold (AND), then the sort: Top rated is overall then likes, Most
 *  liked is likes; Newest keeps the given order. */
export function filterPlaceReviews(list: PlaceReview[], f: PlaceFilters): PlaceReview[] {
	const shown = list.filter(
		(r) =>
			(!f.dish || dishKey(r.dish) === f.dish) &&
			(!f.following || r.followed) &&
			(!f.photos || r.hasPhotos)
	);
	if (f.sort === 'top') return shown.sort((a, b) => b.overall - a.overall || b.likes - a.likes);
	if (f.sort === 'liked') return shown.sort((a, b) => b.likes - a.likes);
	return shown;
}

export const DISH_CAP = 8;

/** Desktop shows the top 8 dishes behind a "+N more" chip, keeping a selected one past the cap
 *  visible. It only caps from 10 dishes: hiding a single chip behind "+1 more" saves nothing. */
export function capDishes(
	chips: DishChip[],
	selected: string | null,
	expanded: boolean
): { shown: DishChip[]; hidden: number; capped: boolean } {
	if (expanded || chips.length <= DISH_CAP + 1) {
		return { shown: chips, hidden: 0, capped: false };
	}
	const shown = chips.filter((c, i) => i < DISH_CAP || c.key === selected);
	return { shown, hidden: chips.length - shown.length, capped: true };
}
