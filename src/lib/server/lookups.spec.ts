import { describe, expect, it } from 'vitest';
import { nestCriteria } from './lookups.ts';
import type { ratingCategories, ratingCriteriaOptions } from './db/schema/index.ts';

type Category = typeof ratingCategories.$inferSelect;
type Option = typeof ratingCriteriaOptions.$inferSelect;

function category(overrides: Partial<Category> = {}): Category {
	return {
		id: 1,
		name: 'Food quality',
		slug: 'food-quality',
		appliesToFood: true,
		appliesToDrink: false,
		appliesToPlace: false,
		appliesToDineIn: true,
		appliesToTakeaway: true,
		appliesToDelivery: true,
		ratingRequired: false,
		displayOrder: 0,
		isActive: true,
		...overrides
	};
}

function option(overrides: Partial<Option> = {}): Option {
	return {
		id: 1,
		ratingCategoryId: 1,
		label: 'Delicious',
		sentiment: 'positive',
		scoreWeight: null,
		displayOrder: 0,
		isActive: true,
		...overrides
	};
}

describe('nestCriteria', () => {
	it('splits options into positive and negative by sentiment', () => {
		const [result] = nestCriteria(
			[category()],
			[
				option({ id: 1, label: 'Delicious', sentiment: 'positive' }),
				option({ id: 2, label: 'Bland', sentiment: 'negative' })
			]
		);
		expect(result.positive.map((o) => o.label)).toEqual(['Delicious']);
		expect(result.negative.map((o) => o.label)).toEqual(['Bland']);
	});

	it('drops neutral options from both lists', () => {
		const [result] = nestCriteria([category()], [option({ sentiment: 'neutral' })]);
		expect(result.positive).toHaveLength(0);
		expect(result.negative).toHaveLength(0);
	});

	it('gives a category with no options two empty arrays', () => {
		const [result] = nestCriteria([category()], []);
		expect(result.positive).toEqual([]);
		expect(result.negative).toEqual([]);
	});

	it('preserves displayOrder within each list', () => {
		const [result] = nestCriteria(
			[category()],
			[
				option({ id: 1, label: 'Second', sentiment: 'positive', displayOrder: 1 }),
				option({ id: 2, label: 'First', sentiment: 'positive', displayOrder: 0 })
			]
		);
		// nestCriteria itself doesn't sort — it relies on the caller's query ORDER BY — so it
		// must preserve whatever order the options arrived in.
		expect(result.positive.map((o) => o.label)).toEqual(['Second', 'First']);
	});

	it('keeps options scoped to their own category', () => {
		const [a, b] = nestCriteria(
			[category({ id: 1 }), category({ id: 2, name: 'Drink quality', slug: 'drink-quality' })],
			[
				option({ id: 1, ratingCategoryId: 1, label: 'Delicious', sentiment: 'positive' }),
				option({ id: 2, ratingCategoryId: 2, label: 'Refreshing', sentiment: 'positive' })
			]
		);
		expect(a.positive.map((o) => o.label)).toEqual(['Delicious']);
		expect(b.positive.map((o) => o.label)).toEqual(['Refreshing']);
	});
});
