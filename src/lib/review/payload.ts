import type { PublishReview, ReviewItemInput } from './schema.ts';
import type {
	CategoryRatingDraft,
	ItemDraft,
	MealType,
	PlaceOption,
	PhotoDraft,
	ReviewTypeChoice,
	VisitType
} from './draft.svelte.ts';

/**
 * The plain data `$state.snapshot(draft)` produces — listed explicitly rather than derived
 * from the ReviewDraft class, since a snapshot is a plain data clone and does not carry the
 * class's getters (hasDish/hasBev/items). This module recomputes those from reviewType
 * instead of depending on a snapshot preserving them.
 */
export interface ReviewDraftSnapshot {
	reviewId: string;
	reviewType: ReviewTypeChoice;
	visitType: VisitType;
	mealType: MealType;
	visitedAt: string;
	place: PlaceOption | null;
	newPlaceName: string;
	dish: ItemDraft;
	drink: ItemDraft;
	placeRatings: CategoryRatingDraft[];
	isFavorite: boolean;
	title: string;
	description: string;
	visibility: 'public' | 'friends' | 'private';
	photos: PhotoDraft[];
}

/** Phnom Penh's city centre (near Wat Phnom) — the placeholder location for a manually added
 *  place, until the Map phase adds real geocoding. See the approved plan's "Places" decision. */
export const PLACEHOLDER_PLACE_LOCATION = { lat: 11.5564, lng: 104.9282 };

function parseMoney(raw: string): number | null {
	const n = parseFloat(raw.replace(',', '.'));
	return Number.isFinite(n) && n >= 0 ? n : null;
}

function nullIfBlank(s: string): string | null {
	const trimmed = s.trim();
	return trimmed === '' ? null : trimmed;
}

/** `draft.visitedAt` is a native date input's raw value — '' once the user clears the field.
 *  `new Date('').toISOString()` throws a RangeError (Invalid Date), and this is called from a
 *  `$derived` on every draft change, so that throw would break the wizard's render the instant
 *  the field is cleared. Passing the raw string through on parse failure instead lets
 *  `publishReviewSchema`'s `z.iso.datetime()` reject it the normal way — a controlled
 *  validation failure, not an exception — while Step1Visit's own emptiness check (see
 *  validateStep in +page.svelte) is what actually stops the user getting this far. */
function toIsoVisitedAt(raw: string): string {
	const date = new Date(raw);
	return Number.isNaN(date.getTime()) ? raw : date.toISOString();
}

/** Drops a rating the person never actually interacted with, so an empty star + no tags
 *  entry for every seeded category doesn't get sent as a wall of meaningless rows. */
function usedRatings(ratings: CategoryRatingDraft[]): PublishReview['placeRatings'] {
	return ratings
		.filter(
			(r) =>
				r.ratingValue !== null ||
				r.criteriaOptionIds.length > 0 ||
				r.customCriteria.length > 0 ||
				r.comment
		)
		.map((r) => ({
			ratingCategoryId: r.ratingCategoryId,
			ratingValue: r.ratingValue,
			isApplicable: true,
			criteriaOptionIds: r.criteriaOptionIds,
			customCriteria: r.customCriteria,
			comment: r.comment
		}));
}

function toItemInput(item: ItemDraft): ReviewItemInput {
	const shared = {
		itemName: item.itemName.trim(),
		description: nullIfBlank(item.description ?? ''),
		price: parseMoney(item.price),
		taxPercent: item.taxPercent.trim() === '' ? null : parseMoney(item.taxPercent),
		currencyCode: item.currencyCode,
		individualRating: item.individualRating,
		isFavorite: item.isFavorite,
		isLeastFavorite: item.isLeastFavorite,
		ratings: usedRatings(item.ratings)
	};
	if (item.itemType === 'food') {
		return {
			...shared,
			itemType: 'food',
			cuisineTypeId: item.cuisineTypeId,
			cuisineTypeOther: nullIfBlank(item.cuisineTypeOther ?? ''),
			foodTypeIds: item.foodTypeIds,
			foodTypeOther: nullIfBlank(item.foodTypeOther ?? ''),
			portionSize: item.portionSize,
			tasteNotes: nullIfBlank(item.tasteNotes ?? '')
		};
	}
	return {
		...shared,
		itemType: 'drink',
		drinkTypeId: item.drinkTypeId,
		drinkTypeOther: nullIfBlank(item.drinkTypeOther ?? ''),
		sizeLabel: nullIfBlank(item.sizeLabel),
		sugarLevelPercent: item.sugarLevelPercent,
		iceLevel: item.iceLevel
	};
}

const REVIEW_TYPE_MAP = { dish: 'food', beverage: 'drink', both: 'combined' } as const;

function hasDish(reviewType: ReviewTypeChoice): boolean {
	return reviewType !== 'beverage';
}

function hasBev(reviewType: ReviewTypeChoice): boolean {
	return reviewType !== 'dish';
}

/** Builds the exact payload the publish action validates — pure, so it's unit-testable
 *  without mounting any component. Call with `$state.snapshot(draft)` from the wizard. */
export function buildPublishPayload(draft: ReviewDraftSnapshot): PublishReview {
	const place: PublishReview['place'] = draft.place
		? { kind: 'existing', placeId: draft.place.id }
		: {
				kind: 'new',
				name: draft.newPlaceName.trim(),
				placeCategoryId: null,
				lat: PLACEHOLDER_PLACE_LOCATION.lat,
				lng: PLACEHOLDER_PLACE_LOCATION.lng,
				addressLine1: null,
				city: 'Phnom Penh',
				countryCode: 'KH'
			};

	const items: ReviewItemInput[] = [];
	if (hasDish(draft.reviewType)) items.push(toItemInput(draft.dish));
	if (hasBev(draft.reviewType)) items.push(toItemInput(draft.drink));

	return {
		reviewId: draft.reviewId,
		reviewType: REVIEW_TYPE_MAP[draft.reviewType],
		visitType: draft.visitType,
		mealType: hasDish(draft.reviewType) ? draft.mealType : null,
		visitedAt: toIsoVisitedAt(draft.visitedAt),
		place,
		title: nullIfBlank(draft.title),
		description: nullIfBlank(draft.description),
		visibility: draft.visibility,
		isFavorite: draft.isFavorite,
		items: items as PublishReview['items'],
		placeRatings: usedRatings(draft.placeRatings),
		photos: draft.photos.map((p, i) => ({
			publicId: p.publicId,
			version: p.version,
			signature: p.signature,
			format: p.format,
			width: p.width,
			height: p.height,
			bytes: p.bytes,
			caption: p.caption,
			isCover: draft.photos.some((x) => x.isCover) ? p.isCover : i === 0
		}))
	};
}
