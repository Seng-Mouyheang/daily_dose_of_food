/** Reactive wizard state for the "Write a review" flow. A thin, UI-shaped model — not the
 *  publish payload itself (see payload.ts for the pure mapping to PublishReview). Field names
 *  mostly track the prototype's own `S` state object. */

import { todayIso } from './format.ts';

export type ReviewTypeChoice = 'dish' | 'beverage' | 'both';
export type VisitType = 'dine_in' | 'takeaway' | 'delivery';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface PlaceOption {
	id: string;
	name: string;
	addressLine1: string | null;
	city: string | null;
	distanceMeters: number | null;
}

export interface CategoryRatingDraft {
	ratingCategoryId: number;
	ratingValue: number | null;
	criteriaOptionIds: number[];
	/** Tags typed into a tag group's "+" add pill, not yet a real `rating_criteria_options` row
	 *  — unlike criteriaOptionIds (seeded option ids), these are plain labels. Resolved to a
	 *  real row (reused if one with this label already exists for the category) only when the
	 *  review is published; see findOrCreateCriteriaOption in src/lib/server/lookups.ts. */
	customCriteria: { label: string; sentiment: 'positive' | 'negative' }[];
	comment: string | null;
}

export interface ItemDraft {
	itemType: 'food' | 'drink';
	itemName: string;
	description: string | null;
	/** Kept as the raw input string so a half-typed "7." doesn't get coerced mid-edit; parsed
	 *  to a number (or null) only when building the publish payload. */
	price: string;
	taxPercent: string;
	currencyCode: string;
	individualRating: number | null;
	isFavorite: boolean;
	isLeastFavorite: boolean;
	ratings: CategoryRatingDraft[];
	// food-only
	cuisineTypeId: number | null;
	/** A custom cuisine typed into the Cuisine select's "Other…" field, not yet a real lookup
	 *  row — mutually exclusive with cuisineTypeId. Resolved to a real row (reused if one with
	 *  this name already exists) only when the review is published; see
	 *  findOrCreateLookupEntry in src/lib/server/lookups.ts. */
	cuisineTypeOther: string | null;
	foodTypeIds: number[];
	foodTypeOther: string | null;
	portionSize: 'small' | 'regular' | 'large' | null;
	tasteNotes: string | null;
	// drink-only
	drinkTypeId: number | null;
	drinkTypeOther: string | null;
	/** '' means unset — kept as a plain string so TileGroup's `T extends string` is satisfied;
	 *  payload.ts maps '' back to null for the schema. */
	sizeLabel: string;
	sugarLevelPercent: number | null;
	iceLevel: string | null;
}

export interface PhotoDraft {
	publicId: string;
	version: number;
	signature: string;
	format: string;
	width: number;
	height: number;
	bytes: number;
	caption: string | null;
	isCover: boolean;
	/** Cloudinary's own delivery URL — local display only, never sent to the server, which
	 *  reconstructs the authoritative URL itself (see cloudinary.ts). */
	previewUrl: string;
}

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
		cuisineTypeOther: null,
		foodTypeIds: [],
		foodTypeOther: null,
		portionSize: null,
		tasteNotes: null,
		drinkTypeId: null,
		drinkTypeOther: null,
		sizeLabel: '',
		sugarLevelPercent: 100,
		iceLevel: null
	};
}

/**
 * Finds or creates a category's rating entry in a (reactive) ratings array. Mutates
 * (pushes) when missing, so it must only be called from an `$effect` or an event handler —
 * never directly in a template expression or inside `$derived(...)`. Svelte 5 forbids
 * mutating state as a side effect of a derived computation (`state_unsafe_mutation`), and
 * every template/prop expression is implicitly one of those; callers that need a read-only
 * lookup for markup should use `findRating` instead.
 */
export function ensureRating(
	list: CategoryRatingDraft[],
	ratingCategoryId: number
): CategoryRatingDraft {
	let rating = list.find((r) => r.ratingCategoryId === ratingCategoryId);
	if (!rating) {
		rating = {
			ratingCategoryId,
			ratingValue: null,
			criteriaOptionIds: [],
			customCriteria: [],
			comment: null
		};
		list.push(rating);
	}
	return rating;
}

/** Pure, read-only counterpart to `ensureRating` — safe to call directly from a template or
 *  `$derived`. Falls back to a fresh (unpersisted) default so markup never has to null-check,
 *  but in normal use the real entry already exists by the time anything can read it, because
 *  the component seeds it via `$effect` before the first paint. */
export function findRating(
	list: CategoryRatingDraft[],
	ratingCategoryId: number
): CategoryRatingDraft {
	return (
		list.find((r) => r.ratingCategoryId === ratingCategoryId) ?? {
			ratingCategoryId,
			ratingValue: null,
			criteriaOptionIds: [],
			customCriteria: [],
			comment: null
		}
	);
}

const STORAGE_KEY = 'ddf-review-draft';

export class ReviewDraft {
	reviewId = $state(crypto.randomUUID());
	step = $state(1);

	reviewType = $state<ReviewTypeChoice>('dish');
	visitType = $state<VisitType>('dine_in');
	mealType = $state<MealType>('lunch');
	visitedAt = $state(todayIso());

	placeQuery = $state('');
	place = $state<PlaceOption | null>(null);
	newPlaceName = $state('');

	dish = $state<ItemDraft>(emptyItem('food'));
	drink = $state<ItemDraft>(emptyItem('drink'));

	placeRatings = $state<CategoryRatingDraft[]>([]);

	isFavorite = $state(false);
	title = $state('');
	description = $state('');
	visibility = $state<'public' | 'friends' | 'private'>('public');

	photos = $state<PhotoDraft[]>([]);

	get hasDish() {
		return this.reviewType !== 'beverage';
	}

	get hasBev() {
		return this.reviewType !== 'dish';
	}

	get items(): ItemDraft[] {
		const list: ItemDraft[] = [];
		if (this.hasDish) list.push(this.dish);
		if (this.hasBev) list.push(this.drink);
		return list;
	}

	/**
	 * A plain object exposing the wizard's current field values — deliberately NOT
	 * `$state.snapshot(this)`. Verified empirically (via a live repro against the real dev
	 * server) that `$state.snapshot()` does not work on a class instance's `$state` class
	 * fields the way it does on a plain `$state({...})` object: it returned `{}`, silently
	 * dropping every field. Nested values (dish/drink/place/photos/ratings) stay live
	 * reactive references here, which is fine — every consumer (ReviewCard, saveToLocalStorage,
	 * buildPublishPayload) only reads them, and both JSON.stringify and plain property reads
	 * work correctly through Svelte's reactive proxies without needing a snapshot at all.
	 */
	toSnapshot() {
		return {
			reviewId: this.reviewId,
			reviewType: this.reviewType,
			visitType: this.visitType,
			mealType: this.mealType,
			visitedAt: this.visitedAt,
			place: this.place,
			newPlaceName: this.newPlaceName,
			dish: this.dish,
			drink: this.drink,
			placeRatings: this.placeRatings,
			isFavorite: this.isFavorite,
			title: this.title,
			description: this.description,
			visibility: this.visibility,
			photos: this.photos
		};
	}

	/** Best-effort crash resistance — there is no server-side draft yet (see the plan's "No
	 *  draft action" note), so a refresh mid-wizard would otherwise lose everything. */
	saveToLocalStorage() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.toSnapshot()));
		} catch {
			// Private browsing / blocked storage: the wizard still works, it just won't survive a refresh.
		}
	}

	restoreFromLocalStorage() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			// A draft saved before `customCriteria` existed on CategoryRatingDraft won't have it on
			// any of its rating entries — back-fill it so usedRatings (payload.ts) doesn't crash
			// reading .length off undefined. ensureRating/findRating always set it for anything
			// created fresh; this is only needed for ratings restored straight from old JSON.
			for (const ratings of [parsed.dish?.ratings, parsed.drink?.ratings, parsed.placeRatings]) {
				for (const r of ratings ?? []) r.customCriteria ??= [];
			}
			Object.assign(this, parsed);
		} catch {
			// Corrupt or inaccessible storage: start fresh rather than throw.
		}
	}

	static clearLocalStorage() {
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {
			// Nothing to clean up if storage isn't available.
		}
	}
}
