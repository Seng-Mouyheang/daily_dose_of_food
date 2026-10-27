/**
 * Day-level maths for the Log page: streak, daily budget, labels and the week strip. Everything
 * runs on plain "YYYY-MM-DD" strings (see dashboard/period.ts). Pure and unit-tested.
 */
import { MONTHS, addDays, monthGrid } from '#lib/dashboard/period.ts';
import { MEALS, groupVisits, type LogEntry, type MealType } from './visits.ts';

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

const validDay = (s: string | null): s is string =>
	s !== null && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const validMonth = (s: string | null): s is string =>
	s !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

/** The day being looked at and the month the calendar shows. A bad or out-of-range day falls
 *  back to today; the month defaults to the day's own and stays between the first log and today. */
export function parseLogQuery(
	params: URLSearchParams,
	first: string,
	today: string
): { day: string; month: string } {
	const raw = params.get('day');
	const day = validDay(raw) ? clampDay(raw, first, today) : today;
	const m = params.get('month');
	const month =
		validMonth(m) && m >= first.slice(0, 7) && m <= today.slice(0, 7) ? m : day.slice(0, 7);
	return { day, month };
}

/** The URL for a day; today with the calendar on its own month is the bare /log. */
export function logHref(day: string, today: string, month?: string): string {
	const q = new URLSearchParams();
	if (day !== today) q.set('day', day);
	if (month && month !== day.slice(0, 7)) q.set('month', month);
	const s = q.toString();
	return s ? `/log?${s}` : '/log';
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** Spent, visits and the mean rating over the logs of one day's entries. */
export function daySummary(entries: LogEntry[]) {
	return {
		spent: cents(entries.reduce((t, l) => t + l.price, 0)),
		visits: groupVisits(entries).length,
		rating: entries.length ? entries.reduce((t, l) => t + l.overall, 0) / entries.length : null
	};
}

/** A month's totals from its entries. `daysElapsed` stops at today, so "16 of 16" in October. */
export function monthSummary(entries: LogEntry[], month: string, today: string) {
	const perPlace = new Map<string, number>();
	for (const l of entries) perPlace.set(l.place, (perPlace.get(l.place) ?? 0) + 1);
	const top = [...perPlace].sort((a, b) => b[1] - a[1])[0];
	return {
		spent: cents(entries.reduce((t, l) => t + l.price, 0)),
		visits: groupVisits(entries).length,
		daysLogged: new Set(entries.map((l) => l.date)).size,
		daysElapsed: monthGrid(month).days.filter((d) => d <= today).length,
		mostVisited: top ? top[0] : null
	};
}

/** The month `n` steps from "YYYY-MM" (negative goes back). */
export function shiftMonth(month: string, n: number): string {
	const [y, m] = month.split('-').map(Number);
	const t = y! * 12 + (m! - 1) + n;
	const year = Math.floor(t / 12);
	return `${year}-${String(t - year * 12 + 1).padStart(2, '0')}`;
}
