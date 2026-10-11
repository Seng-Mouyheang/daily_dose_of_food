/** The home sidebar's "Your <month>" panel: the numbers, and the one-line habit observation
 *  under them. Pure — the server hands it the month's rows and this counts them, so the
 *  interesting part (what counts as a habit, what happens with no reviews) is testable without
 *  a database. The rows are few enough per person per month that counting them in TS is
 *  cheaper to read than the equivalent SQL aggregate, and it keeps the thresholds visible. */
import { VISIT_LABEL } from './card.ts';

export interface MonthReviewRow {
	overallRating: number;
	visitType: string;
	mealType: string | null;
}

export interface MonthItemRow {
	price: number | null;
	taxPercent: number | null;
}

export interface MonthlyStats {
	reviewCount: number;
	/** Null with no reviews, so the panel shows a dash rather than "NaN" or a misleading 0.0. */
	averageRating: number | null;
	totalSpent: number;
	/** Null when nothing stands out — better to say nothing than to dress up a 1-of-2 tie as a
	 *  pattern. */
	habitLine: string | null;
}

const MEAL_PLURAL: Record<string, string> = {
	breakfast: 'breakfasts',
	lunch: 'lunches',
	dinner: 'dinners',
	snack: 'snacks'
};

/** The most frequent value, and how often it occurred. Ties resolve to whichever came first,
 *  which is arbitrary but stable — and the caller's threshold means a 1-1 tie never surfaces. */
function mode(values: string[]): { value: string; count: number } | null {
	const counts = new Map<string, number>();
	for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

	let best: { value: string; count: number } | null = null;
	for (const [value, count] of counts) {
		if (!best || count > best.count) best = { value, count };
	}
	return best;
}

/** Needs to describe at least half the month, and at least two reviews — one review is a data
 *  point, not a habit. */
function dominant(values: string[], total: number): string | null {
	const top = mode(values);
	if (!top || top.count < 2 || top.count * 2 < total) return null;
	return top.value;
}

export function summarizeMonth(reviews: MonthReviewRow[], items: MonthItemRow[]): MonthlyStats {
	const reviewCount = reviews.length;

	const averageRating =
		reviewCount === 0 ? null : reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviewCount;

	const totalSpent = items.reduce((sum, item) => {
		if (item.price === null) return sum;
		return sum + item.price * (1 + (item.taxPercent ?? 0) / 100);
	}, 0);

	// Meals are the more interesting observation ("mostly dinners"), so they get first look;
	// visit type is the fallback, and matters most for a drink-only month where mealType is
	// null throughout.
	const meal = dominant(
		reviews.flatMap((r) => (r.mealType === null ? [] : [r.mealType])),
		reviewCount
	);
	const visit =
		meal === null
			? dominant(
					reviews.map((r) => r.visitType),
					reviewCount
				)
			: null;

	const habitLine =
		meal !== null
			? `Mostly ${MEAL_PLURAL[meal] ?? meal} this month.`
			: visit !== null
				? `Mostly ${(VISIT_LABEL[visit] ?? visit).toLowerCase()} this month.`
				: null;

	return { reviewCount, averageRating, totalSpent, habitLine };
}
