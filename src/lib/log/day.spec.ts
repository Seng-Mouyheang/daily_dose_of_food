import { describe, expect, it } from 'vitest';
import { clampDay, dailyBudget, dayCounts, dayLabel, defaultMeal, streak, weekOf } from './day.ts';

const TODAY = '2026-10-16'; // a Friday

describe('dayCounts', () => {
	it('counts logs per day', () => {
		expect(dayCounts([{ date: 'a' }, { date: 'a' }, { date: 'b' }])).toEqual({ a: 2, b: 1 });
	});
});

describe('streak', () => {
	it('counts back from today', () => {
		expect(streak({ '2026-10-16': 1, '2026-10-15': 3, '2026-10-14': 1 }, TODAY)).toBe(3);
	});
	it('counts back from yesterday when today is empty', () => {
		expect(streak({ '2026-10-15': 1, '2026-10-14': 1 }, TODAY)).toBe(2);
	});
	it('stops at the first gap', () => {
		expect(streak({ '2026-10-16': 1, '2026-10-14': 1 }, TODAY)).toBe(1);
	});
	it('is 0 with no recent logs', () => {
		expect(streak({ '2026-10-10': 1 }, TODAY)).toBe(0);
		expect(streak({}, TODAY)).toBe(0);
	});
});

describe('dailyBudget', () => {
	it('spreads the monthly budget over the year', () => {
		expect(dailyBudget(350)).toBeCloseTo(11.51, 2);
	});
	it('is null with no budget', () => expect(dailyBudget(null)).toBeNull());
});

describe('defaultMeal', () => {
	it('is the first of breakfast, lunch, dinner not yet logged', () => {
		expect(defaultMeal([])).toBe('breakfast');
		expect(defaultMeal(['breakfast'])).toBe('lunch');
		expect(defaultMeal(['breakfast', 'dinner'])).toBe('lunch');
	});
	it('falls back to snack', () => {
		expect(defaultMeal(['breakfast', 'lunch', 'dinner'])).toBe('snack');
	});
});

describe('clampDay', () => {
	it('keeps a day between the first log and today', () => {
		expect(clampDay('2026-12-01', '2025-01-01', TODAY)).toBe(TODAY);
		expect(clampDay('2024-01-01', '2025-01-01', TODAY)).toBe('2025-01-01');
		expect(clampDay('2026-10-01', '2025-01-01', TODAY)).toBe('2026-10-01');
	});
});

describe('weekOf', () => {
	it('runs Monday to Sunday', () => {
		const w = weekOf(TODAY);
		expect(w[0]).toBe('2026-10-12');
		expect(w[6]).toBe('2026-10-18');
	});
	it('puts a Sunday at the end of its own week', () => {
		expect(weekOf('2026-10-18')[0]).toBe('2026-10-12');
	});
	it('crosses a month boundary', () => {
		expect(weekOf('2026-09-01')).toContain('2026-08-31');
	});
});

describe('dayLabel', () => {
	it('names today and yesterday', () => {
		expect(dayLabel(TODAY, TODAY)).toBe('Today, 16 October 2026');
		expect(dayLabel('2026-10-15', TODAY)).toBe('Yesterday, 15 October 2026');
	});
	it('uses the weekday otherwise, short on mobile', () => {
		expect(dayLabel('2026-09-03', TODAY)).toBe('Thursday, 3 September 2026');
		expect(dayLabel('2026-09-03', TODAY, true)).toBe('Thu, 3 September 2026');
	});
});
