import { describe, expect, it } from 'vitest';
import { periodFor } from '#lib/dashboard/period.ts';
import { summarize, type DashLog } from '#lib/dashboard/summary.ts';
import { earliestByPlace, logToDashLog, placeKey } from './dashboard.ts';

const row = (over: Partial<Parameters<typeof logToDashLog>[0]> = {}) => ({
	id: 'l1',
	loggedOn: '2026-10-15',
	title: 'Cappuccino',
	placeId: null,
	placeName: 'Brown Coffee',
	visitType: 'dine_in',
	mealType: 'lunch',
	overallRating: 4,
	itemType: 'drink',
	price: '5.50',
	foodType: null,
	drinkType: 'Coffee',
	cuisine: null,
	...over
});

describe('placeKey', () => {
	it('is the place id, or the name for a typed place, ignoring case and spaces', () => {
		expect(placeKey('p1', 'Malis')).toBe('p1');
		expect(placeKey(null, ' Brown Coffee ')).toBe('name:brown coffee');
		expect(placeKey(null, 'BROWN COFFEE')).toBe(placeKey(null, 'brown coffee'));
	});
});

describe('logToDashLog', () => {
	it('maps a drink log to one item, tax already in the price, opening its day', () => {
		expect(logToDashLog(row())).toEqual({
			id: 'l1',
			href: '/log?day=2026-10-15',
			date: '2026-10-15',
			title: 'Cappuccino',
			placeId: 'name:brown coffee',
			placeName: 'Brown Coffee',
			visitType: 'dine_in',
			mealType: 'lunch',
			overall: 4,
			items: [{ isDrink: true, kind: 'Coffee', cuisine: null, price: 5.5 }],
			scores: { food: null, value: null, service: null, hygiene: null }
		});
	});
	it('keeps a dish type and cuisine for food, and a known place by its id', () => {
		const d = logToDashLog(
			row({
				placeId: 'p9',
				itemType: 'food',
				foodType: 'Noodles',
				cuisine: 'Khmer',
				drinkType: null
			})
		);
		expect(d.placeId).toBe('p9');
		expect(d.items[0]).toEqual({ isDrink: false, kind: 'Noodles', cuisine: 'Khmer', price: 5.5 });
	});
});

describe('earliestByPlace', () => {
	it('keeps the earliest date per place across sources', () => {
		const m = earliestByPlace(
			[
				['a', '2026-05-01'],
				['b', '2026-07-01']
			],
			[
				['a', '2026-03-01'],
				['c', '2026-09-01']
			]
		);
		expect([...m]).toEqual([
			['a', '2026-03-01'],
			['b', '2026-07-01'],
			['c', '2026-09-01']
		]);
	});
});

describe('logs in the dashboard summary', () => {
	const period = periodFor('month', 0, '2026-10-16');
	const review: DashLog = {
		id: 'r1',
		href: '/review/r1',
		date: '2026-10-10',
		title: 'Fish Amok',
		placeId: 'malis',
		placeName: 'Malis',
		visitType: 'dine_in',
		mealType: 'dinner',
		overall: 5,
		items: [{ kind: 'Main course', cuisine: 'Khmer', isDrink: false, price: 10 }],
		scores: { food: 4, value: 3, service: 4, hygiene: 5 }
	};
	const logs = [logToDashLog(row()), logToDashLog(row({ id: 'l2', price: '2.00' })), review];
	const s = summarize({
		logs,
		prevLogs: [],
		period,
		today: '2026-10-16',
		monthlyBudget: 350,
		firstVisitByPlace: earliestByPlace([
			['name:brown coffee', '2026-10-15'],
			['malis', '2026-01-01']
		])
	});

	it('counts logs and reviews together in the spend', () => {
		expect(s.spend.spent).toBe(17.5);
	});
	it('counts each log as a visit to its place, and a typed place as one place', () => {
		const brown = s.regulars.find((r) => r.name === 'Brown Coffee');
		expect(brown).toMatchObject({ visits: 2, spent: 7.5 });
		expect(s.regulars.map((r) => r.name).sort()).toEqual(['Brown Coffee', 'Malis']);
	});
	it('shows a log in the recent list, linking to its day', () => {
		expect(s.recent.find((l) => l.id === 'l1')?.href).toBe('/log?day=2026-10-15');
	});
});
