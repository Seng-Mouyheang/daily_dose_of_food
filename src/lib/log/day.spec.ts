import { describe, expect, it } from 'vitest';
import {
	clampDay,
	dailyBudget,
	dayCounts,
	dayLabel,
	daySummary,
	defaultMeal,
	logHref,
	monthSummary,
	parseLogQuery,
	shiftMonth,
	streak,
	weekOf
} from './day.ts';
import type { LogEntry } from './visits.ts';

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

describe('parseLogQuery', () => {
	const q = (s: string) => parseLogQuery(new URLSearchParams(s), '2025-01-01', TODAY);
	it('defaults to today and its month', () => {
		expect(q('')).toEqual({ day: TODAY, month: '2026-10' });
	});
	it('reads a day and shows its month', () => {
		expect(q('day=2026-09-03')).toEqual({ day: '2026-09-03', month: '2026-09' });
	});
	it('clamps a day outside the logged range', () => {
		expect(q('day=2026-12-01').day).toBe(TODAY);
		expect(q('day=2020-01-01').day).toBe('2025-01-01');
	});
	it('ignores a bad day', () => {
		expect(q('day=nope').day).toBe(TODAY);
		expect(q('day=2026-13-45').day).toBe(TODAY);
	});
	it('lets the calendar browse another month, within range', () => {
		expect(q('day=2026-10-01&month=2026-07')).toEqual({ day: '2026-10-01', month: '2026-07' });
		expect(q('month=2026-11').month).toBe('2026-10');
		expect(q('month=2024-12').month).toBe('2026-10');
		expect(q('month=2026-00').month).toBe('2026-10');
	});
});

describe('logHref', () => {
	it('is the bare page for today', () => expect(logHref(TODAY, TODAY)).toBe('/log'));
	it('carries the day, and the month only when it differs', () => {
		expect(logHref('2026-09-03', TODAY)).toBe('/log?day=2026-09-03');
		expect(logHref('2026-09-03', TODAY, '2026-09')).toBe('/log?day=2026-09-03');
		expect(logHref('2026-09-03', TODAY, '2026-07')).toBe('/log?day=2026-09-03&month=2026-07');
		expect(logHref(TODAY, TODAY, '2026-07')).toBe('/log?month=2026-07');
	});
});

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({
	id: 'x',
	date: '2026-10-15',
	place: 'Brown Coffee',
	title: 'Cappuccino',
	itemType: 'drink',
	qty: 1,
	price: 2.75,
	taxPercent: null,
	isFavorite: false,
	meal: 'lunch',
	dining: 'dine_in',
	overall: 4,
	note: null,
	reviewId: null,
	...over
});

describe('daySummary', () => {
	it('totals spend, visits and the mean rating over logs', () => {
		const s = daySummary([
			entry(),
			entry({ title: 'Cake', overall: 5, price: 6.5 }),
			entry({ meal: 'dinner', overall: 3 })
		]);
		expect(s).toEqual({ spent: 12, visits: 2, rating: 4 });
	});
	it('has no rating on an empty day', () => {
		expect(daySummary([])).toEqual({ spent: 0, visits: 0, rating: null });
	});
});

describe('monthSummary', () => {
	const logs = [
		entry(),
		entry({ date: '2026-10-16', place: 'Malis', price: 9 }),
		entry({ date: '2026-10-16', place: 'Brown Coffee', meal: 'dinner' })
	];
	it('totals the month and names the most visited place', () => {
		expect(monthSummary(logs, '2026-10', TODAY)).toEqual({
			spent: 14.5,
			visits: 3,
			daysLogged: 2,
			daysElapsed: 16,
			mostVisited: 'Brown Coffee'
		});
	});
	it('counts a whole past month, and has no favorite when empty', () => {
		expect(monthSummary([], '2026-09', TODAY)).toMatchObject({
			daysElapsed: 30,
			mostVisited: null
		});
	});
});

describe('shiftMonth', () => {
	it('steps across year boundaries', () => {
		expect(shiftMonth('2026-10', 1)).toBe('2026-11');
		expect(shiftMonth('2026-12', 1)).toBe('2027-01');
		expect(shiftMonth('2026-01', -1)).toBe('2025-12');
		expect(shiftMonth('2026-03', -15)).toBe('2024-12');
	});
});
