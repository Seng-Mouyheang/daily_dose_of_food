import { describe, expect, it } from 'vitest';
import { summarizeMonth, type MonthReviewRow } from './stats.ts';

function review(overrides: Partial<MonthReviewRow> = {}): MonthReviewRow {
	return { overallRating: 4, visitType: 'dine_in', mealType: 'dinner', ...overrides };
}

describe('summarizeMonth', () => {
	it('reports an empty month without inventing numbers', () => {
		expect(summarizeMonth([], [])).toEqual({
			reviewCount: 0,
			averageRating: null,
			totalSpent: 0,
			habitLine: null
		});
	});

	it('averages the overall ratings', () => {
		const stats = summarizeMonth([review({ overallRating: 5 }), review({ overallRating: 4 })], []);
		expect(stats.reviewCount).toBe(2);
		expect(stats.averageRating).toBe(4.5);
	});

	it('totals item prices with their tax', () => {
		const stats = summarizeMonth(
			[review()],
			[
				{ price: 6.5, taxPercent: 8 },
				{ price: 2, taxPercent: null }
			]
		);
		expect(stats.totalSpent).toBeCloseTo(9.02, 2);
	});

	it('skips an item with no price rather than counting it as zero tax on nothing', () => {
		expect(summarizeMonth([review()], [{ price: null, taxPercent: 10 }]).totalSpent).toBe(0);
	});

	it('names the dominant meal', () => {
		const stats = summarizeMonth(
			[review({ mealType: 'breakfast' }), review({ mealType: 'breakfast' }), review()],
			[]
		);
		expect(stats.habitLine).toBe('Mostly breakfasts this month.');
	});

	it('falls back to the visit type when no meal is recorded', () => {
		const stats = summarizeMonth(
			[
				review({ mealType: null, visitType: 'takeaway' }),
				review({ mealType: null, visitType: 'takeaway' })
			],
			[]
		);
		expect(stats.habitLine).toBe('Mostly takeaway this month.');
	});

	it('says nothing when one review is the whole month', () => {
		expect(summarizeMonth([review()], []).habitLine).toBeNull();
	});

	it('says nothing when no single value describes half the month', () => {
		const stats = summarizeMonth(
			[
				review({ mealType: 'breakfast', visitType: 'dine_in' }),
				review({ mealType: 'lunch', visitType: 'takeaway' }),
				review({ mealType: 'dinner', visitType: 'delivery' })
			],
			[]
		);
		expect(stats.habitLine).toBeNull();
	});

	it('still falls back to the visit type when the meals are spread but the visits are not', () => {
		const stats = summarizeMonth(
			[
				review({ mealType: 'breakfast' }),
				review({ mealType: 'lunch' }),
				review({ mealType: 'dinner' })
			],
			[]
		);
		expect(stats.habitLine).toBe('Mostly dine-in this month.');
	});
});
