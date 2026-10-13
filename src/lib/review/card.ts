/**
 * The review card's view model, plus the adapters that build it.
 *
 * The card is one component used in three places (the wizard's live preview, the home feed, and
 * as the basis of the review page), but its two data sources have nothing in common: a
 * ReviewDraftSnapshot of in-progress `$state`, and a row set read back out of Postgres. Rather
 * than branch inside the component, both sides are mapped to `ReviewCardView` here — which
 * keeps every display rule (which item's name wins, how tags are flattened, what counts as
 * "no photos") in one pure, testable place.
 *
 * Nothing in this module may import from src/lib/server/ — not even a type. A type-only import
 * across that boundary still trips SvelteKit's server/client import guard, so the inputs are
 * declared structurally instead and the real server types satisfy them by TypeScript's
 * structural typing. See the same note at the top of categories.ts.
 */
import type { RatingCategoryView } from './categories.ts';
import { placeCategoriesFor } from './categories.ts';
import { resolveTypeLabel } from './format.ts';
import type { ReviewDraftSnapshot } from './payload.ts';

export interface ReviewCardPhoto {
	url: string;
	caption: string | null;
}

export interface ReviewCardTag {
	label: string;
	sentiment: 'positive' | 'negative';
}

export interface ReviewCardAuthor {
	displayName: string;
	avatarUrl: string | null;
}

export type Visibility = 'public' | 'friends' | 'private';

export interface ReviewCardView {
	/** Where the card links to, or null in the wizard preview — nothing is published yet, so
	 *  there is nowhere to go. Also what the component keys "is this a real, interactive card"
	 *  off of: a null href means no stretched link and no action row. */
	href: string | null;
	author: ReviewCardAuthor;
	/** Null in the preview, for the same reason as `href`. */
	timeAgo: string | null;
	placeName: string;
	visitLabel: string;
	/** Cuisine (food) or drink type — the third segment of the header's meta line. Null when
	 *  the person hasn't picked one. */
	itemTypeLabel: string | null;
	title: string;
	/** Pre-tax, summed across the review's items. Null when no item has a usable price, so the
	 *  card can omit the price rather than print "$0.00". */
	price: number | null;
	photos: ReviewCardPhoto[];
	overallRating: number | null;
	isFavorite: boolean;
	tags: ReviewCardTag[];
	description: string | null;
	/** Always populated, but only rendered by the preview, whose footer shows the visit date
	 *  and who will be able to see this. A published card replaces that footer with the action
	 *  row, since by then both answers are already settled. */
	visitedAt: string | null;
	visibility: Visibility | null;
	/** Engagement. Zero / false on the wizard preview, which has no id to like yet. */
	reviewId: string | null;
	likeCount: number;
	commentCount: number;
	viewerHasLiked: boolean;
	viewerHasSaved: boolean;
	/** False when signed out: the heart then links to sign-in instead of toggling. */
	canLike: boolean;
}

export const VISIT_LABEL: Record<string, string> = {
	dine_in: 'Dine-in',
	takeaway: 'Takeaway',
	delivery: 'Delivery',
	drive_through: 'Drive-through',
	other: 'Other'
};

export const MEAL_LABEL: Record<string, string> = {
	breakfast: 'Breakfast',
	lunch: 'Lunch',
	dinner: 'Dinner',
	snack: 'Snack'
};

/** '' / '   ' -> null, so every optional string in the view model has exactly one empty
 *  representation and the component can test it with a plain `{#if}`. */
function blankToNull(value: string | null | undefined): string | null {
	return value?.trim() ? value.trim() : null;
}

function sumPrices(raw: (string | null)[]): number | null {
	const values = raw.flatMap((r) => {
		const n = parseFloat((r ?? '').replace(',', '.'));
		return Number.isFinite(n) && n >= 0 ? [n] : [];
	});
	return values.length === 0 ? null : values.reduce((a, b) => a + b, 0);
}

/** The lookups `cardViewFromDraft` needs to turn ids into labels. Structural, so the real
 *  `NestedRatingCategory[]` / lookup arrays from getReviewFormLookups() satisfy it directly. */
export interface DraftCardLookups {
	categories: RatingCategoryView[];
	foodTypes: { id: number; name: string }[];
	drinkTypes: { id: number; name: string }[];
}

/**
 * The wizard's live preview.
 *
 * draft.placeRatings / dish.ratings / drink.ratings only ever grow — Step 2's seeding effect
 * never removes an entry — so switching visit type away from one that had a category
 * applicable, or switching review type away from "Both", leaves a stale rating sitting in the
 * array for a category or item no longer in play. The server drops exactly these when
 * publishing (applicablePlaceCategoryIds / applicableItemCategoryIds in server/reviews.ts), and
 * buildPublishPayload only sends the active item(s) at all — mirrored here so the preview never
 * shows a star, tag or average for something that won't actually be published.
 */
export function cardViewFromDraft(
	draft: ReviewDraftSnapshot,
	lookups: DraftCardLookups,
	author: ReviewCardAuthor
): ReviewCardView {
	const placeCategoryIds = new Set(
		placeCategoriesFor(lookups.categories, draft.visitType).map((c) => c.id)
	);
	const hasDish = draft.reviewType !== 'beverage';
	const hasDrink = draft.reviewType !== 'dish';

	const ratings = [
		...draft.placeRatings.filter((r) => placeCategoryIds.has(r.ratingCategoryId)),
		...(hasDish ? draft.dish.ratings : []),
		...(hasDrink ? draft.drink.ratings : [])
	];

	const values = ratings.flatMap((r) => (r.ratingValue === null ? [] : [r.ratingValue]));
	const overallRating =
		values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;

	const tags: ReviewCardTag[] = [];
	for (const rating of ratings) {
		const category = lookups.categories.find((c) => c.id === rating.ratingCategoryId);
		if (category) {
			for (const optionId of rating.criteriaOptionIds) {
				const positive = category.positive.find((o) => o.id === optionId);
				if (positive) {
					tags.push({ label: positive.label, sentiment: 'positive' });
					continue;
				}
				const negative = category.negative.find((o) => o.id === optionId);
				if (negative) tags.push({ label: negative.label, sentiment: 'negative' });
			}
		}
		// A tag the person typed themselves has no option id yet — it only becomes one on
		// publish (findOrCreateCriteriaOption) — but it still belongs on the preview card.
		for (const custom of rating.customCriteria) {
			tags.push({ label: custom.label, sentiment: custom.sentiment });
		}
	}

	// The third meta segment: the dish's food type, or the drink's drink type — whichever item
	// is in play. "Both" prefers the dish, matching how `title` below prefers the dish name.
	const itemTypeLabel = hasDish
		? resolveTypeLabel(
				draft.dish.foodTypeIds[0] ?? null,
				draft.dish.foodTypeOther,
				lookups.foodTypes
			)
		: resolveTypeLabel(draft.drink.drinkTypeId, draft.drink.drinkTypeOther, lookups.drinkTypes);

	// Falls through to the other item's name so a "Both" review that only has the drink filled
	// in so far still shows something real instead of "Untitled review".
	const title =
		blankToNull(hasDish ? draft.dish.itemName : draft.drink.itemName) ??
		blankToNull(hasDish ? draft.drink.itemName : draft.dish.itemName) ??
		'Untitled review';

	return {
		href: null,
		author,
		timeAgo: null,
		placeName: draft.place?.name ?? blankToNull(draft.newPlaceName) ?? 'Choose a place',
		visitLabel: VISIT_LABEL[draft.visitType] ?? draft.visitType,
		itemTypeLabel,
		title,
		price: sumPrices([hasDish ? draft.dish.price : null, hasDrink ? draft.drink.price : null]),
		photos: [...draft.photos]
			.sort((a, b) => Number(b.isCover) - Number(a.isCover))
			.map((p) => ({ url: p.previewUrl, caption: p.caption })),
		overallRating,
		isFavorite: draft.isFavorite,
		tags,
		description: blankToNull(draft.description),
		visitedAt: draft.visitedAt,
		visibility: draft.visibility,
		reviewId: null,
		likeCount: 0,
		commentCount: 0,
		viewerHasLiked: false,
		viewerHasSaved: false,
		canLike: false
	};
}

/* ------------------------------------------------------------------------------------------
 * The published side: a review read back out of the database.
 *
 * These shapes are declared here, on the client side of the import guard, and
 * src/lib/server/feed.ts imports them so there is exactly one definition. That direction is
 * fine — server code may import client modules, just not the reverse.
 *
 * Everything is JSON-plain: numbers are numbers (Postgres hands `numeric` back as a string and
 * timestamps as Date objects, and feed.ts converts both at its edge), so these adapters can be
 * unit-tested with literals and nothing downstream has to remember to coerce before calling
 * .toFixed().
 * ---------------------------------------------------------------------------------------- */

export interface FeedPhoto {
	url: string;
	caption: string | null;
	width: number | null;
	height: number | null;
}

export interface FeedPlace {
	id: string;
	name: string;
	addressLine1: string | null;
	city: string | null;
}

export interface FeedItem {
	id: string;
	itemType: 'food' | 'drink';
	itemName: string;
	price: number | null;
	taxPercent: number | null;
	/** Food type (for a dish) or drink type — the card's third meta segment. */
	typeLabel: string | null;
	/** Food only. */
	cuisineLabel: string | null;
	portionSize: string | null;
	sizeLabel: string | null;
	sugarLevelPercent: number | null;
	iceLevel: string | null;
}

export interface FeedCategoryRating {
	categoryId: number;
	slug: string;
	name: string;
	ratingValue: number | null;
}

export interface FeedReview {
	id: string;
	author: ReviewCardAuthor;
	place: FeedPlace;
	reviewType: string;
	visitType: string;
	mealType: string | null;
	/** ISO instants. */
	visitedAt: string;
	publishedAt: string | null;
	overallRating: number;
	title: string | null;
	description: string | null;
	visibility: Visibility;
	isFavorite: boolean;
	photos: FeedPhoto[];
	items: FeedItem[];
	tags: ReviewCardTag[];
	categoryRatings: FeedCategoryRating[];
	likeCount: number;
	commentCount: number;
	/** Always false for a signed-out viewer. */
	viewerHasLiked: boolean;
	viewerHasSaved: boolean;
}

export interface ReviewComment {
	id: string;
	body: string;
	/** ISO instant. */
	createdAt: string;
	author: ReviewCardAuthor;
	/** The viewer wrote it, so the page offers Edit and Delete. */
	isOwn: boolean;
	/** An attached photo, if any. */
	photo: { url: string; width: number | null; height: number | null } | null;
	/** The review's author pinned this top-level comment to the top. */
	pinned: boolean;
	/** The thread's top-level comment when this is a reply; null for a top-level comment. */
	parentId: string | null;
	/** ISO instant of the last edit, or null if never edited. */
	editedAt: string | null;
	likeCount: number;
	viewerHasLiked: boolean;
}

/** The item the card speaks for: the dish on a review that covers both, otherwise whatever
 *  single item there is. Mirrors cardViewFromDraft's "Both prefers the dish". */
export function primaryItem(items: FeedItem[]): FeedItem | null {
	return items.find((i) => i.itemType === 'food') ?? items[0] ?? null;
}

export function reviewTitle(review: FeedReview): string {
	const item = primaryItem(review.items);
	return blankToNull(item?.itemName) ?? blankToNull(review.title) ?? 'Untitled review';
}

/** Pre-tax sum across a review's items; null when none of them carries a price. */
export function totalBeforeTax(items: FeedItem[]): number | null {
	const values = items.flatMap((item) => (item.price === null ? [] : [item.price]));
	return values.length === 0 ? null : values.reduce((a, b) => a + b, 0);
}

export function totalWithTax(items: FeedItem[]): number | null {
	const values = items.flatMap((item) =>
		item.price === null ? [] : [item.price * (1 + (item.taxPercent ?? 0) / 100)]
	);
	return values.length === 0 ? null : values.reduce((a, b) => a + b, 0);
}

/** A published review as the feed's card. `timeAgoLabel` is passed in rather than computed
 *  here so this stays independent of the clock — the caller is a `$derived` that already has
 *  to decide what "now" means. */
export function cardViewFromRow(
	review: FeedReview,
	timeAgoLabel: string,
	canLike = false
): ReviewCardView {
	const item = primaryItem(review.items);

	return {
		href: `/review/${review.id}`,
		author: review.author,
		timeAgo: timeAgoLabel,
		placeName: review.place.name,
		visitLabel: VISIT_LABEL[review.visitType] ?? review.visitType,
		itemTypeLabel: item?.typeLabel ?? null,
		title: reviewTitle(review),
		price: totalBeforeTax(review.items),
		photos: review.photos.map((p) => ({ url: p.url, caption: p.caption })),
		overallRating: review.overallRating,
		isFavorite: review.isFavorite,
		tags: review.tags,
		description: blankToNull(review.description),
		visitedAt: review.visitedAt,
		visibility: review.visibility,
		reviewId: review.id,
		likeCount: review.likeCount,
		commentCount: review.commentCount,
		viewerHasLiked: review.viewerHasLiked,
		viewerHasSaved: review.viewerHasSaved,
		canLike
	};
}

export interface AggregatedCategoryRating {
	slug: string;
	name: string;
	value: number;
}

/**
 * One row per rating category for the review page's bar panel.
 *
 * A category can be scored more than once on the same review — "Food quality" is rated per item
 * on a review that covers both a dish and a drink, and the schema's two unique indexes allow one
 * place-scoped rating plus one per item for each category. The panel shows the category once, so
 * the scores for it are averaged, and categories nobody actually scored are dropped rather than
 * drawn as an empty bar.
 *
 * Order follows the order the rows arrive in, which the query sets to the categories' own
 * displayOrder — so Food quality leads and Amenities trails, as in the form.
 */
export function aggregateCategoryRatings(
	ratings: FeedCategoryRating[]
): AggregatedCategoryRating[] {
	const bySlug = new Map<string, { name: string; values: number[] }>();

	for (const rating of ratings) {
		if (rating.ratingValue === null) continue;
		const existing = bySlug.get(rating.slug);
		if (existing) existing.values.push(rating.ratingValue);
		else bySlug.set(rating.slug, { name: rating.name, values: [rating.ratingValue] });
	}

	return [...bySlug].map(([slug, { name, values }]) => ({
		slug,
		name,
		value: values.reduce((a, b) => a + b, 0) / values.length
	}));
}

/** Splits the card's flat tag list into the review page's two groups. */
export function splitTags(tags: ReviewCardTag[]): {
	positive: ReviewCardTag[];
	negative: ReviewCardTag[];
} {
	return {
		positive: tags.filter((t) => t.sentiment === 'positive'),
		negative: tags.filter((t) => t.sentiment === 'negative')
	};
}
