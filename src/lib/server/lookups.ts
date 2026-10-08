import { and, eq } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { slugify } from '../../../scripts/seed-data.ts';
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

const LOOKUP_TABLES = { cuisine: cuisineTypes, food: foodTypes, drink: drinkTypes } as const;
export type LookupKind = keyof typeof LOOKUP_TABLES;

export interface LookupEntry {
	id: number;
	name: string;
	/** True if this call inserted the row (vs. finding one an earlier request already created).
	 *  Callers that need the resolution to only "stick" once some later step succeeds use this
	 *  to know which rows are theirs to delete on rollback — a reused row must never be deleted
	 *  just because *this* request's later step failed. */
	created: boolean;
}

/**
 * Resolves a user-typed "Other" value (cuisine, dish type, or drink type) to a real lookup
 * row, creating one if no match exists yet — the wizard's `Select` then treats it exactly
 * like any seeded option from then on. Dedupes on `slug`, not the raw `name`, so "Pizza" /
 * "pizza" / "  Pizza  " all resolve to the same row, matching the table's own unique index on
 * slug. If a concurrent request creates the same slug first, `onConflictDoNothing` simply
 * loses that race and the follow-up select picks up the row it created instead — no error,
 * no duplicate.
 */
export async function findOrCreateLookupEntry(
	kind: LookupKind,
	rawName: string
): Promise<LookupEntry> {
	const name = rawName.trim().slice(0, 100);
	const slug = slugify(name);
	if (!name || !slug) {
		throw new Error('A name is required.');
	}

	const table = LOOKUP_TABLES[kind];
	const [inserted] = await db
		.insert(table)
		.values({ name, slug })
		.onConflictDoNothing({ target: table.slug })
		.returning({ id: table.id, name: table.name });
	if (inserted) return { ...inserted, created: true };

	const [existing] = await db
		.select({ id: table.id, name: table.name })
		.from(table)
		.where(eq(table.slug, slug))
		.limit(1);
	if (!existing) throw new Error('Could not resolve this option. Try again.');
	return { ...existing, created: false };
}

/** Best-effort cleanup for a lookup row this request created but never ended up using (the
 *  publish it was resolved for failed afterward). Safe to call on a row other rows may have
 *  started referencing since — the FK's `onDelete: 'restrict'`/default RESTRICT makes the
 *  delete a no-op in that case rather than cascading damage. */
export async function deleteUnusedLookupEntry(kind: LookupKind, id: number): Promise<void> {
	const table = LOOKUP_TABLES[kind];
	await db
		.delete(table)
		.where(eq(table.id, id))
		.catch(() => {});
}

export interface CriteriaOptionEntry {
	id: number;
	label: string;
	/** See LookupEntry.created. */
	created: boolean;
}

/**
 * Resolves a user-typed tag (from a rating category's "+" add pill) to a real
 * rating_criteria_options row, creating one if no match exists yet. Mirrors
 * findOrCreateLookupEntry above, but dedupes on the table's own unique constraint —
 * (ratingCategoryId, label, sentiment) — since this table has no slug column of its own.
 */
export async function findOrCreateCriteriaOption(
	ratingCategoryId: number,
	sentiment: 'positive' | 'negative',
	rawLabel: string
): Promise<CriteriaOptionEntry> {
	const label = rawLabel.trim().slice(0, 150);
	if (!label) {
		throw new Error('A label is required.');
	}

	const [inserted] = await db
		.insert(ratingCriteriaOptions)
		.values({ ratingCategoryId, label, sentiment })
		.onConflictDoNothing({
			target: [
				ratingCriteriaOptions.ratingCategoryId,
				ratingCriteriaOptions.label,
				ratingCriteriaOptions.sentiment
			]
		})
		.returning({ id: ratingCriteriaOptions.id, label: ratingCriteriaOptions.label });
	if (inserted) return { ...inserted, created: true };

	const [existing] = await db
		.select({ id: ratingCriteriaOptions.id, label: ratingCriteriaOptions.label })
		.from(ratingCriteriaOptions)
		.where(
			and(
				eq(ratingCriteriaOptions.ratingCategoryId, ratingCategoryId),
				eq(ratingCriteriaOptions.label, label),
				eq(ratingCriteriaOptions.sentiment, sentiment)
			)
		)
		.limit(1);
	if (!existing) throw new Error('Could not resolve this tag. Try again.');
	return { ...existing, created: false };
}

/** Best-effort cleanup for a criteria option this request created but never ended up using
 *  (the publish it was resolved for failed afterward). See deleteUnusedLookupEntry. */
export async function deleteUnusedCriteriaOption(id: number): Promise<void> {
	await db
		.delete(ratingCriteriaOptions)
		.where(eq(ratingCriteriaOptions.id, id))
		.catch(() => {});
}
