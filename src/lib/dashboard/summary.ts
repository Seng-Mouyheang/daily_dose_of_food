/**
 * Every number the dashboard shows, computed from one list of logs so the sections always agree
 * (Σ "Where it went" = Total spent = Σ trend bars). Pure: the server hands it the logs, this
 * counts them. Numbers only — formatting and copy belong to the components.
 */
import { MEAL_LABEL, VISIT_LABEL } from '#lib/review/card.ts';
import { addDays, type Period } from './period.ts';

export interface DashItem {
	/** Food type or drink type name; null when the item has none. */
	kind: string | null;
	/** Food items only; null for drinks. */
	cuisine: string | null;
	isDrink: boolean;
	/** Paid, tax included. */
	price: number;
}

export interface DashLog {
	id: string;
	/** Local visit date, "YYYY-MM-DD". */
	date: string;
	title: string;
	placeId: string;
	placeName: string;
	visitType: string;
	mealType: string | null;
	overall: number;
	items: DashItem[];
	scores: {
		food: number | null;
		value: number | null;
		service: number | null;
		hygiene: number | null;
	};
}

export type Dim = 'kind' | 'cuisine' | 'meal';
export interface Bar {
	name: string;
	value: number;
	count: number;
}
export interface Bucket {
	/** A date for daily buckets, "YYYY-MM" for monthly ones. */
	key: string;
	value: number;
	count: number;
	future: boolean;
}

const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((t, x) => t + f(x), 0);
const mean = (xs: number[]) => (xs.length ? sum(xs, (x) => x) / xs.length : null);
export const logPrice = (l: DashLog) => sum(l.items, (i) => i.price);

const BUDGET_FACTOR = { week: 12 / 52, month: 1, year: 12 };
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TOP = 5;

/** Sorted biggest first, with everything past the top 5 folded into "Other (n)". */
function rank(groups: Map<string, Bar>): Bar[] {
	const rows = [...groups.values()].sort((a, b) => b.value - a.value || b.count - a.count);
	if (rows.length <= TOP + 1) return rows;
	const rest = rows.slice(TOP);
	return [
		...rows.slice(0, TOP),
		{
			name: `Other (${rest.length})`,
			value: sum(rest, (r) => r.value),
			count: sum(rest, (r) => r.count)
		}
	];
}

function add(groups: Map<string, Bar>, name: string, value: number) {
	const g = groups.get(name) ?? { name, value: 0, count: 0 };
	g.value += value;
	g.count++;
	groups.set(name, g);
}

/** Spend grouped by type, cuisine or meal. Split per item, so a dish-and-drink review counts
 *  toward both; the bars still add up to the total because every item lands in one group. */
export function whereItWent(logs: DashLog[], dim: Dim): Bar[] {
	const groups = new Map<string, Bar>();
	for (const l of logs)
		for (const i of l.items) {
			const name =
				dim === 'kind'
					? (i.kind ?? (i.isDrink ? 'Other drinks' : 'Other dishes'))
					: dim === 'cuisine'
						? i.isDrink
							? 'Drinks'
							: (i.cuisine ?? 'Other')
						: l.mealType
							? (MEAL_LABEL[l.mealType] ?? l.mealType)
							: 'Drinks';
			add(groups, name, i.price);
		}
	return rank(groups);
}

/** "Nice" chart ceiling: rounded up to 10, 25 or 100 depending on size. */
export function niceTop(max: number): number {
	const step = max > 200 ? 100 : max > 50 ? 25 : 10;
	return Math.max(step, Math.ceil(max / step) * step);
}

function trend(logs: DashLog[], period: Period, today: string): Bucket[] {
	const byKey = new Map<string, { value: number; count: number }>();
	const keyOf = (date: string) => (period.per === 'year' ? date.slice(0, 7) : date);
	for (const l of logs) {
		const b = byKey.get(keyOf(l.date)) ?? { value: 0, count: 0 };
		b.value += logPrice(l);
		b.count++;
		byKey.set(keyOf(l.date), b);
	}
	const keys =
		period.per === 'year'
			? Array.from(
					{ length: 12 },
					(_, m) => `${period.start.slice(0, 4)}-${String(m + 1).padStart(2, '0')}`
				)
			: Array.from({ length: period.length }, (_, d) => addDays(period.start, d));
	return keys.map((key) => ({
		key,
		...(byKey.get(key) ?? { value: 0, count: 0 }),
		future: key > keyOf(today)
	}));
}

export function summarize(input: {
	logs: DashLog[];
	prevLogs: DashLog[];
	period: Period;
	today: string;
	monthlyBudget: number | null;
	/** Each place's first-ever log date, for "New places". */
	firstVisitByPlace: Map<string, string>;
}) {
	const { logs, prevLogs, period, today } = input;
	const spent = sum(logs, logPrice);
	const prevSpent = sum(prevLogs, logPrice);
	const budget =
		input.monthlyBudget === null ? null : input.monthlyBudget * BUDGET_FACTOR[period.per];

	const places = new Set(logs.map((l) => l.placeId));
	const newPlaces = [...places].filter(
		(p) => (input.firstVisitByPlace.get(p) ?? '') >= period.start
	).length;

	const buckets = trend(logs, period, today);
	const past = buckets.filter((b) => !b.future);
	const peak = past.reduce<Bucket | null>((m, b) => (b.value > (m?.value ?? 0) ? b : m), null);

	const byPlace = new Map<
		string,
		{ name: string; visits: number; spent: number; ratings: number[] }
	>();
	for (const l of logs) {
		const p = byPlace.get(l.placeId) ?? { name: l.placeName, visits: 0, spent: 0, ratings: [] };
		p.visits++;
		p.spent += logPrice(l);
		p.ratings.push(l.overall);
		byPlace.set(l.placeId, p);
	}

	const scores = (['food', 'value', 'service', 'hygiene'] as const).map((k) => ({
		key: k,
		value: mean(logs.flatMap((l) => (l.scores[k] === null ? [] : [l.scores[k]])))
	}));
	const rated = scores.filter((s) => s.value !== null);

	const share = (f: (l: DashLog) => string) => {
		const g = new Map<string, Bar>();
		for (const l of logs) add(g, f(l), 1);
		return [...g.values()].sort((a, b) => b.value - a.value);
	};
	const weekdayCounts = Array(7).fill(0) as number[];
	for (const l of logs) weekdayCounts[new Date(`${l.date}T00:00:00Z`).getUTCDay()]!++;

	const byNewest = [...logs].sort((a, b) => b.date.localeCompare(a.date));
	const good = logs.filter((l) => l.overall >= 4);

	return {
		spend: {
			spent,
			prevSpent,
			budget,
			/** Where an even pace would be today; null once the period is over. */
			expected: budget !== null && period.live ? (budget * period.elapsed) / period.length : null,
			/** Projected total at the current pace. */
			pace: period.live ? (spent / period.elapsed) * period.length : spent,
			daysLeft: period.length - period.elapsed
		},
		kpis: {
			meals: { now: logs.length, prev: prevLogs.length },
			avgPrice: {
				now: logs.length ? spent / logs.length : null,
				prev: prevLogs.length ? prevSpent / prevLogs.length : null
			},
			avgRating: {
				now: mean(logs.map((l) => l.overall)),
				prev: mean(prevLogs.map((l) => l.overall))
			},
			newPlaces,
			placeCount: places.size
		},
		trend: {
			buckets,
			avg: mean(past.map((b) => b.value)) ?? 0,
			top: niceTop(Math.max(0, ...buckets.map((b) => b.value))),
			peak
		},
		where: {
			kind: whereItWent(logs, 'kind'),
			cuisine: whereItWent(logs, 'cuisine'),
			meal: whereItWent(logs, 'meal')
		},
		highlights: logs.length
			? {
					top: [...logs].sort(
						(a, b) =>
							b.overall - a.overall ||
							(b.scores.food ?? 0) - (a.scores.food ?? 0) ||
							b.date.localeCompare(a.date)
					)[0]!,
					value: [...(good.length ? good : logs)].sort(
						(a, b) => (b.scores.value ?? 0) - (a.scores.value ?? 0) || logPrice(a) - logPrice(b)
					)[0]!,
					splurge: [...logs].sort((a, b) => logPrice(b) - logPrice(a))[0]!
				}
			: null,
		regulars: [...byPlace.entries()]
			.map(([id, p]) => ({
				id,
				name: p.name,
				visits: p.visits,
				spent: p.spent,
				rating: mean(p.ratings)!
			}))
			.sort((a, b) => b.visits - a.visits || b.spent - a.spent)
			.slice(0, 4),
		ratings: {
			scores,
			toughest: rated.length ? rated.reduce((m, s) => (s.value! < m.value! ? s : m)).key : null
		},
		habits: {
			meals: share((l) => (l.mealType ? (MEAL_LABEL[l.mealType] ?? l.mealType) : 'Drinks')),
			visits: share((l) => VISIT_LABEL[l.visitType] ?? l.visitType),
			busiestDay: logs.length ? WEEKDAYS[weekdayCounts.indexOf(Math.max(...weekdayCounts))]! : null
		},
		recent: byNewest.slice(0, 5)
	};
}

export type DashboardSummary = ReturnType<typeof summarize>;
