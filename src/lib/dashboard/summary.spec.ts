import { describe, expect, it } from 'vitest';
import { periodFor } from './period.ts';
import { logPrice, niceTop, summarize, whereItWent, type DashLog } from './summary.ts';

let n = 0;
function log(over: Partial<DashLog> = {}): DashLog {
	return {
		id: `r${++n}`,
		date: '2026-10-10',
		title: 'Fish Amok',
		placeId: 'malis',
		placeName: 'Malis',
		visitType: 'dine_in',
		mealType: 'dinner',
		overall: 4,
		items: [{ kind: 'Main course', cuisine: 'Khmer', isDrink: false, price: 10 }],
		scores: { food: 4, value: 3, service: 4, hygiene: 5 },
		...over
	};
}
const period = periodFor('month', 0, '2026-10-16');
const run = (logs: DashLog[], extra: Partial<Parameters<typeof summarize>[0]> = {}) =>
	summarize({
		logs,
		prevLogs: [],
		period,
		today: '2026-10-16',
		monthlyBudget: 350,
		firstVisitByPlace: new Map(),
		...extra
	});

describe('summarize', () => {
	it('gives nulls, not NaN, for an empty period', () => {
		const s = run([]);
		expect(s.spend.spent).toBe(0);
		expect(s.kpis.avgPrice.now).toBeNull();
		expect(s.kpis.avgRating.now).toBeNull();
		expect(s.highlights).toBeNull();
		expect(s.ratings.toughest).toBeNull();
		expect(s.habits.busiestDay).toBeNull();
		expect(s.trend.peak).toBeNull();
	});

	it('keeps every section adding up to the same total', () => {
		const logs = [
			log(),
			log({
				date: '2026-10-12',
				items: [
					{ kind: 'Dessert', cuisine: 'French', isDrink: false, price: 6.5 },
					{ kind: 'Coffee', cuisine: null, isDrink: true, price: 2.75 }
				]
			}),
			log({
				date: '2026-10-12',
				mealType: null,
				items: [{ kind: 'Tea', cuisine: null, isDrink: true, price: 3 }]
			})
		];
		const s = run(logs);
		const total = 10 + 6.5 + 2.75 + 3;
		expect(s.spend.spent).toBeCloseTo(total);
		for (const dim of ['kind', 'cuisine', 'meal'] as const)
			expect(s.where[dim].reduce((t, b) => t + b.value, 0)).toBeCloseTo(total);
		expect(s.trend.buckets.reduce((t, b) => t + b.value, 0)).toBeCloseTo(total);
		expect(s.trend.buckets).toHaveLength(31);
		expect(s.trend.buckets.filter((b) => b.future)).toHaveLength(15);
		expect(s.trend.peak?.key).toBe('2026-10-12');
	});

	it('splits a dish-and-drink review across types', () => {
		const bars = whereItWent(
			[
				log({
					items: [
						{ kind: 'Dessert', cuisine: 'French', isDrink: false, price: 6 },
						{ kind: 'Coffee', cuisine: null, isDrink: true, price: 3 }
					]
				})
			],
			'cuisine'
		);
		expect(bars.map((b) => [b.name, b.value])).toEqual([
			['French', 6],
			['Drinks', 3]
		]);
	});

	it('folds past the top 5 into Other', () => {
		const kinds = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
		const bars = whereItWent(
			kinds.map((k, i) =>
				log({ items: [{ kind: k, cuisine: null, isDrink: false, price: 10 - i }] })
			),
			'kind'
		);
		expect(bars).toHaveLength(6);
		expect(bars[5]).toEqual({ name: 'Other (2)', value: 5 + 4, count: 2 });
	});

	it('leaves missing sub-scores out of the averages', () => {
		const s = run([
			log({ scores: { food: 5, value: null, service: 2, hygiene: null } }),
			log({ scores: { food: 3, value: 4, service: null, hygiene: null } })
		]);
		const byKey = Object.fromEntries(s.ratings.scores.map((r) => [r.key, r.value]));
		expect(byKey).toEqual({ food: 4, value: 4, service: 2, hygiene: null });
		expect(s.ratings.toughest).toBe('service');
	});

	it('paces against the budget', () => {
		const s = run([log({ items: [{ kind: null, cuisine: null, isDrink: false, price: 160 }] })]);
		expect(s.spend.budget).toBe(350);
		expect(s.spend.expected).toBeCloseTo((350 * 16) / 31);
		expect(s.spend.pace).toBeCloseTo((160 / 16) * 31);
		expect(s.spend.daysLeft).toBe(15);
		expect(run([], { monthlyBudget: null }).spend.budget).toBeNull();
		expect(
			summarize({
				logs: [],
				prevLogs: [],
				period: periodFor('week', 0, '2026-10-16'),
				today: '2026-10-16',
				monthlyBudget: 520,
				firstVisitByPlace: new Map()
			}).spend.budget
		).toBe(120);
	});

	it('counts places first visited in this period as new', () => {
		const s = run([log(), log({ placeId: 'brown', placeName: 'Brown' })], {
			firstVisitByPlace: new Map([
				['malis', '2025-03-01'],
				['brown', '2026-10-05']
			])
		});
		expect(s.kpis).toMatchObject({ newPlaces: 1, placeCount: 2 });
	});

	it('picks highlights and regulars', () => {
		const cheap = log({
			overall: 4,
			scores: { food: 4, value: 5, service: 4, hygiene: 4 },
			items: [{ kind: null, cuisine: null, isDrink: false, price: 2 }]
		});
		const best = log({ overall: 5, placeId: 'brown', placeName: 'Brown' });
		const pricey = log({
			overall: 3,
			items: [{ kind: null, cuisine: null, isDrink: false, price: 40 }]
		});
		const s = run([cheap, best, pricey]);
		expect(s.highlights).toEqual({ top: best, value: cheap, splurge: pricey });
		expect(s.regulars[0]).toMatchObject({ id: 'malis', visits: 2, spent: 42 });
		expect(logPrice(pricey)).toBe(40);
	});
});

describe('niceTop', () => {
	it('rounds the chart ceiling up', () => {
		expect(niceTop(0)).toBe(10);
		expect(niceTop(37)).toBe(40);
		expect(niceTop(120)).toBe(125);
		expect(niceTop(1234)).toBe(1300);
	});
});
