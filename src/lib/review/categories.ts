import type { IconName } from '../components/icons.ts';
import type { VisitType } from './draft.svelte.ts';

/**
 * The shape the UI needs from a rating category — listed explicitly rather than imported
 * from src/lib/server/lookups.ts. A type-only import from src/lib/server/ into a
 * client-reachable module still trips SvelteKit's server/client import guard, so this stays
 * structurally compatible instead: the real NestedRatingCategory the load function returns
 * satisfies this interface automatically (TypeScript's structural typing), with no import
 * needed. See reviews.ts's applicablePlaceCategoryIds/applicableItemCategoryIds — the
 * filtering logic here intentionally mirrors that server-side truth for a consistent UX; the
 * server re-applies it authoritatively regardless of what the client sends.
 */
export interface RatingOption {
	id: number;
	label: string;
}

export interface RatingCategoryView {
	id: number;
	slug: string;
	name: string;
	appliesToFood: boolean;
	appliesToDrink: boolean;
	appliesToPlace: boolean;
	appliesToDineIn: boolean;
	appliesToTakeaway: boolean;
	appliesToDelivery: boolean;
	positive: RatingOption[];
	negative: RatingOption[];
}

function categoryAppliesToVisit(category: RatingCategoryView, visitType: VisitType): boolean {
	switch (visitType) {
		case 'dine_in':
			return category.appliesToDineIn;
		case 'takeaway':
			return category.appliesToTakeaway;
		case 'delivery':
			return category.appliesToDelivery;
	}
}

export function placeCategoriesFor(
	categories: RatingCategoryView[],
	visitType: VisitType
): RatingCategoryView[] {
	return categories.filter((c) => c.appliesToPlace && categoryAppliesToVisit(c, visitType));
}

export function itemCategoriesFor(
	categories: RatingCategoryView[],
	itemType: 'food' | 'drink'
): RatingCategoryView[] {
	return categories.filter((c) => (itemType === 'food' ? c.appliesToFood : c.appliesToDrink));
}

/** Seeded categories don't carry an icon column, so the UI maps slug -> icon itself (mirrors
 *  the prototype's hard-coded CAT.*.i). Falls back to a generic icon for any future category. */
const CATEGORY_ICON: Record<string, IconName> = {
	'food-quality': 'plate',
	'drink-quality': 'coffee',
	price: 'tag',
	service: 'bell',
	hygiene: 'sparkle',
	amenities: 'wifi'
};

export function categoryIcon(slug: string): IconName {
	return CATEGORY_ICON[slug] ?? 'sparkle';
}

/** "Service" reads as "Delivery service" for a delivery visit, matching the prototype's catLabel(). */
export function categoryLabel(category: RatingCategoryView, visitType: VisitType): string {
	if (category.slug === 'service' && visitType === 'delivery') return 'Delivery service';
	return category.name;
}
