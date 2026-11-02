import { emptyItem, type ItemDraft, type PlaceOption } from '#lib/review/draft.svelte.ts';
import type { ReviewDraftSnapshot } from '#lib/review/payload.ts';
import { beforeTax, type DiningType, type MealType } from './visits.ts';

/** A saved log, as much of it as a review can start from. */
export interface SourceLog {
	loggedOn: string;
	placeName: string | null;
	title: string;
	itemType: 'food' | 'drink';
	foodTypeId: number | null;
	drinkTypeId: number | null;
	cuisineTypeId: number | null;
	qty: number;
	/** Line total paid, tax included */
	price: number;
	taxPercent: number | null;
	isFavorite: boolean;
	mealType: MealType;
	visitType: DiningType;
	overallRating: number;
	note: string | null;
}

/** A {@link SourceLog} that can also be linked: with its id and the place it points at. */
export interface LinkableLog extends SourceLog {
	id: string;
	placeId: string | null;
}

/** The ids of the logs that are part of the visit a review describes: same day and same place.
 *  Anything else a client sends along is not this visit and stays in the Log. A log typed in with
 *  just a place name matches a place picked since, since the two can't be told apart. */
export function logsOfVisit(
	logs: LinkableLog[],
	review: {
		visitedAt: string;
		place: { kind: 'existing'; placeId: string } | { kind: 'new'; name: string };
	}
): string[] {
	const day = review.visitedAt.slice(0, 10);
	const name = (s: string | null) => (s ?? '').trim().toLowerCase();
	const samePlace = (l: LinkableLog) =>
		review.place.kind === 'existing'
			? (l.placeId ?? review.place.placeId) === review.place.placeId
			: !l.placeId && name(l.placeName) === name(review.place.name);
	return logs.filter((l) => l.loggedOn === day && samePlace(l)).map((l) => l.id);
}

/** The review form's starting point for a visit: one dish and one drink fit the wizard, so the
 *  first of each carries over with its price, kind, rating and heart, and anything beyond them
 *  is listed in the description as "Also had". A quantity stays in the name ("2× Latte") so the
 *  price keeps meaning what was paid. The visit's note becomes the description. A place typed
 *  in the log stays a new place's name; a known one is passed in. */
export function logsToReviewDraft(
	logs: SourceLog[],
	place: PlaceOption | null,
	reviewId: string
): ReviewDraftSnapshot {
	const first = logs[0]!;
	const dish = logs.find((l) => l.itemType === 'food');
	const drink = logs.find((l) => l.itemType === 'drink');

	const item = (l: SourceLog | undefined, type: 'food' | 'drink'): ItemDraft => {
		const base = emptyItem(type);
		if (!l) return base;
		return {
			...base,
			itemName: (l.qty > 1 ? `${l.qty}× ${l.title}` : l.title).slice(0, 200),
			price: String(beforeTax(l)),
			taxPercent: l.taxPercent === null ? '' : String(l.taxPercent),
			individualRating: l.overallRating,
			isFavorite: l.isFavorite,
			cuisineTypeId: l.cuisineTypeId,
			foodTypeIds: l.foodTypeId === null ? [] : [l.foodTypeId],
			drinkTypeId: l.drinkTypeId
		};
	};

	const alsoHad = logs
		.filter((l) => l !== dish && l !== drink)
		.map((l) => (l.qty > 1 ? `${l.qty}× ${l.title}` : l.title));
	const description = [
		logs.find((l) => l.note)?.note,
		alsoHad.length ? `Also had: ${alsoHad.join(', ')}` : null
	]
		.filter(Boolean)
		.join('\n\n');

	return {
		reviewId,
		reviewType: dish && drink ? 'both' : drink ? 'beverage' : 'dish',
		visitType: first.visitType,
		mealType: first.mealType,
		visitedAt: first.loggedOn,
		place,
		newPlaceName: place ? '' : (first.placeName ?? ''),
		dish: item(dish, 'food'),
		drink: item(drink, 'drink'),
		placeRatings: [],
		isFavorite: false,
		title: '',
		description,
		visibility: 'public',
		photos: []
	};
}
