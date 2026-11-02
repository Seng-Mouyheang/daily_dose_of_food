/**
 * The Log groups a day's logs into visits. A visit is never stored: it is every log sharing a
 * date, meal, place and dining option, so the page reads it and the dashboard counts the logs.
 * Pure and unit-tested. Labels come from review/card.ts (MEAL_LABEL, VISIT_LABEL).
 */

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEALS)[number];

export const DINING_OPTIONS = ['dine_in', 'takeaway', 'delivery'] as const;
export type DiningType = (typeof DINING_OPTIONS)[number];

export interface LogEntry {
	id: string;
	/** "YYYY-MM-DD" in the user's time zone */
	date: string;
	/** Display name: the place's name, or the text typed in the log form */
	place: string;
	title: string;
	itemType: 'food' | 'drink';
	qty: number;
	/** Line total paid (price each × qty) */
	price: number;
	meal: MealType;
	dining: DiningType;
	/** 1–5 */
	overall: number;
	note: string | null;
	/** Set when the log is a published review: it stays its own visit and opens that review. */
	reviewId: string | null;
}

export interface Visit {
	key: string;
	date: string;
	meal: MealType;
	place: string;
	dining: DiningType;
	reviewId: string | null;
	items: LogEntry[];
	price: number;
	overall: number;
	/** Every item is a drink: picks the cup icon over the plate */
	drink: boolean;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** Price paid for one line: price each × qty, plus tax (a percentage), to the cent. */
export const lineTotal = (priceEach: number, qty: number, taxPercent = 0) =>
	cents(priceEach * qty * (1 + taxPercent / 100));

export const visitKey = (l: Pick<LogEntry, 'date' | 'meal' | 'place' | 'dining' | 'reviewId'>) =>
	[l.date, l.meal, l.place, l.dining, l.reviewId ?? ''].join('|');

/** Groups logs into visits, in the order each visit first appears. */
export function groupVisits(logs: LogEntry[]): Visit[] {
	const byKey = new Map<string, LogEntry[]>();
	for (const l of logs) {
		const k = visitKey(l);
		const list = byKey.get(k);
		if (list) list.push(l);
		else byKey.set(k, [l]);
	}
	return [...byKey].map(([key, items]) => {
		const first = items[0]!;
		return {
			key,
			date: first.date,
			meal: first.meal,
			place: first.place,
			dining: first.dining,
			reviewId: first.reviewId,
			items,
			price: cents(items.reduce((t, l) => t + l.price, 0)),
			overall: items.reduce((t, l) => t + l.overall, 0) / items.length,
			drink: items.every((l) => l.itemType === 'drink')
		};
	});
}

/** "2× Cappuccino & Croissant", or "A, B +2 more" once there are more than two. */
export function visitTitle(items: Pick<LogEntry, 'title' | 'qty'>[]): string {
	const names = items.map((l) => (l.qty > 1 ? `${l.qty}× ${l.title}` : l.title));
	return names.length > 2
		? `${names.slice(0, 2).join(', ')} +${names.length - 2} more`
		: names.join(' & ');
}
