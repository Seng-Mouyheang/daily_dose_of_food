import { describe, expect, it } from 'vitest';
import {
	cuisineSeed,
	dashboardSeed,
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

	it('generates dashboard demo data that only uses seeded lookups and places', () => {
		const rows = dashboardSeed('2025-01-01', '2025-12-31');
		const twice = dashboardSeed('2025-01-01', '2025-12-31');
		expect(rows).toEqual(twice);
		expect(rows.length).toBeGreaterThan(300);
		const places = new Set(placeSeed.map((p) => p.slug));
		const kinds = new Set([...foodTypeSeed, ...drinkTypeSeed].map((t) => t.name));
		const cuisines = new Set(cuisineSeed.map((c) => c.name));
		const categories = new Set(ratingCategorySeed.map((c) => slugify(c.name)));
		for (const r of rows) {
			expect(places.has(r.placeSlug)).toBe(true);
			expect(kinds.has(r.item.kind)).toBe(true);
			if (r.item.cuisine !== null) expect(cuisines.has(r.item.cuisine)).toBe(true);
			expect(r.item.price).toBeGreaterThan(0);
			expect(r.date >= '2025-01-01' && r.date <= '2025-12-31').toBe(true);
			for (const slug of Object.keys(r.scores)) expect(categories.has(slug)).toBe(true);
		}
	});
});
