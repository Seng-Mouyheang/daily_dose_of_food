import { describe, expect, it } from 'vitest';
import {
	categoryLabel,
	itemCategoriesFor,
	placeCategoriesFor,
	type RatingCategoryView
} from './categories.ts';

function category(overrides: Partial<RatingCategoryView> = {}): RatingCategoryView {
	return {
		id: 1,
		slug: 'price',
		name: 'Price',
		appliesToFood: false,
		appliesToDrink: false,
		appliesToPlace: true,
		appliesToDineIn: true,
		appliesToTakeaway: true,
		appliesToDelivery: true,
		positive: [],
		negative: [],
		...overrides
	};
}

describe('placeCategoriesFor', () => {
	it('drops a category whose appliesToDelivery flag is false', () => {
		const amenities = category({
			id: 2,
			slug: 'amenities',
			appliesToDelivery: false,
			appliesToTakeaway: false
		});
		expect(placeCategoriesFor([amenities], 'delivery')).toHaveLength(0);
		expect(placeCategoriesFor([amenities], 'dine_in')).toHaveLength(1);
	});

	it('excludes item-scoped categories entirely', () => {
		const foodQuality = category({
			id: 3,
			slug: 'food-quality',
			appliesToPlace: false,
			appliesToFood: true
		});
		expect(placeCategoriesFor([foodQuality], 'dine_in')).toHaveLength(0);
	});
});

describe('itemCategoriesFor', () => {
	it('matches food items only to appliesToFood categories', () => {
		const foodQuality = category({ id: 1, appliesToFood: true, appliesToPlace: false });
		const drinkQuality = category({ id: 2, appliesToDrink: true, appliesToPlace: false });
		expect(itemCategoriesFor([foodQuality, drinkQuality], 'food')).toEqual([foodQuality]);
	});
});

describe('categoryLabel', () => {
	it('renames Service to "Delivery service" for a delivery visit', () => {
		const service = category({ slug: 'service', name: 'Service' });
		expect(categoryLabel(service, 'delivery')).toBe('Delivery service');
		expect(categoryLabel(service, 'dine_in')).toBe('Service');
	});
});
