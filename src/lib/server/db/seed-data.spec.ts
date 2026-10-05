import { describe, expect, it } from 'vitest';
import {
	cuisineSeed,
	drinkTypeSeed,
	foodTypeSeed,
	placeCategorySeed,
	ratingCategorySeed,
	slugify
} from '../../../../scripts/seed-data.ts';

const unique = (xs: string[]) => new Set(xs).size === xs.length;

describe('seed data', () => {
	it('slugifies names', () => {
		expect(slugify('Café')).toBe('cafe');
		expect(slugify('Street-food stall')).toBe('street-food-stall');
	});

	it('has unique slugs in every lookup', () => {
		for (const list of [placeCategorySeed, cuisineSeed, foodTypeSeed, drinkTypeSeed]) {
			expect(unique(list.map((x) => x.slug))).toBe(true);
		}
		expect(unique(ratingCategorySeed.map((c) => slugify(c.name)))).toBe(true);
	});

	it('has unique tag labels within each rating category', () => {
		for (const c of ratingCategorySeed) {
			expect(unique([...c.positive, ...c.negative])).toBe(true);
		}
	});
});
