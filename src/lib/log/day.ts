/**
 * Day-level maths for the Log page: streak, daily budget, labels and the week strip. Everything
 * runs on plain "YYYY-MM-DD" strings (see dashboard/period.ts). Pure and unit-tested.
 */
import { MONTHS, addDays } from '#lib/dashboard/period.ts';
import { MEALS, type MealType } from './visits.ts';

/** How many logs fall on each day. */
export function dayCounts(logs: { date: string }[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const l of logs) counts[l.date] = (counts[l.date] ?? 0) + 1;
	return counts;
}

/** Consecutive days with a log, counting back from today, or from yesterday if today is empty. */
export function streak(counts: Record<string, number>, today: string): number {
	let day = counts[today] ? today : addDays(today, -1);
	let n = 0;
	while (counts[day]) {
		n++;
		day = addDays(day, -1);
	}
	return n;
}

/** The monthly budget spread over the year's days; null when the user hasn't set one. */
export const dailyBudget = (monthly: number | null) =>
	monthly === null ? null : (monthly * 12) / 365;

/** The first of breakfast, lunch and dinner not yet logged that day, otherwise snack. */
export function defaultMeal(logged: MealType[]): MealType {
	return MEALS.slice(0, 3).find((m) => !logged.includes(m)) ?? 'snack';
}

export function clampDay(day: string, first: string, today: string): string {
	if (day > today) return today;
	return day < first ? first : day;
}

/** The seven days (Monday first) of the week containing `day`. */
export function weekOf(day: string): string[] {
	const dow = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
	const monday = addDays(day, -dow);
	return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const weekday = (iso: string, style: 'short' | 'long') =>
	new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: style, timeZone: 'UTC' });

/** "Today, 16 October 2026", "Yesterday, …", otherwise "Thursday, 3 September 2026"
 *  (the weekday is abbreviated on mobile). */
export function dayLabel(day: string, today: string, short = false): string {
	const [y, m, d] = day.split('-').map(Number);
	const date = `${d} ${MONTHS[m! - 1]} ${y}`;
	if (day === today) return `Today, ${date}`;
	if (day === addDays(today, -1)) return `Yesterday, ${date}`;
	return `${weekday(day, short ? 'short' : 'long')}, ${date}`;
}
