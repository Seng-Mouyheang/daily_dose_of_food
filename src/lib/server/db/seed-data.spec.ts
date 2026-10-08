import { describe, expect, it } from 'vitest';
import {
	cuisineSeed,
	drinkTypeSeed,
	foodTypeSeed,
	placeCategorySeed,
	placeSeed,
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

	it('gives every seeded place a unique slug', () => {
		expect(unique(placeSeed.map((p) => p.slug))).toBe(true);
	});

	it('only references place categories that actually exist in the seed', () => {
		const categorySlugs = new Set(placeCategorySeed.map((c) => c.slug));
		for (const p of placeSeed) expect(categorySlugs.has(p.placeCategorySlug)).toBe(true);
	});

	it('gives every seeded place a plausible SRID=4326 WKT point', () => {
		for (const p of placeSeed)
			expect(p.locationWkt).toMatch(/^SRID=4326;POINT\(-?\d+(\.\d+)? -?\d+(\.\d+)?\)$/);
	});
});
