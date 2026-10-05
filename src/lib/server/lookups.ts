import { eq } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { db } from './db/index.ts';
import {
	cuisineTypes,
	drinkTypes,
	foodTypes,
	placeCategories,
	ratingCategories,
	ratingCriteriaOptions
} from './db/schema/index.ts';

type RatingCategory = typeof ratingCategories.$inferSelect;
type CriteriaOption = typeof ratingCriteriaOptions.$inferSelect;

export interface NestedRatingCategory extends RatingCategory {
	positive: CriteriaOption[];
	negative: CriteriaOption[];
}

/** Pure: groups criteria options under their category by sentiment. Neutral options are
 *  dropped from both lists — the wizard only ever renders good/bad tag pickers. */
export function nestCriteria(
	categories: RatingCategory[],
	criteria: CriteriaOption[]
): NestedRatingCategory[] {
	const byCategory = new Map<number, CriteriaOption[]>();
	for (const option of criteria) {
		const list = byCategory.get(option.ratingCategoryId);
		if (list) list.push(option);
		else byCategory.set(option.ratingCategoryId, [option]);
	}
	return categories.map((category) => {
		const options = byCategory.get(category.id) ?? [];
		return {
			...category,
			positive: options.filter((o) => o.sentiment === 'positive'),
			negative: options.filter((o) => o.sentiment === 'negative')
		};
	});
}

/** Everything the review wizard's lookups (selects, tag pickers) need, in one round trip. */
export async function getReviewFormLookups() {
	const [categories, criteria, food, cuisine, drink, placeCats] = await db.batch([
		db
			.select()
			.from(ratingCategories)
			.where(eq(ratingCategories.isActive, true))
			.orderBy(ratingCategories.displayOrder),
		db
			.select()
			.from(ratingCriteriaOptions)
			.where(eq(ratingCriteriaOptions.isActive, true))
			.orderBy(ratingCriteriaOptions.displayOrder),
		db.select().from(foodTypes).where(eq(foodTypes.isActive, true)),
		db.select().from(cuisineTypes).where(eq(cuisineTypes.isActive, true)),
		db.select().from(drinkTypes).where(eq(drinkTypes.isActive, true)),
		db
			.select()
			.from(placeCategories)
			.where(eq(placeCategories.isActive, true))
			.orderBy(placeCategories.displayOrder)
	] satisfies [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);

	return {
		categories: nestCriteria(categories, criteria),
		foodTypes: food,
		cuisineTypes: cuisine,
		drinkTypes: drink,
		placeCategories: placeCats
	};
}
