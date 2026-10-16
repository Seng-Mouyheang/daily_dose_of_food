/**
 * The dashboard's period: Week / Month / Year, stepped back by `off`. All calendar maths runs on
 * plain "YYYY-MM-DD" strings (UTC under the hood, so no DST or server-zone drift); only
 * `zonedDayStart` turns a local date into an instant for SQL. Pure and unit-tested.
 */

export type Per = 'week' | 'month' | 'year';

export interface DashboardQuery {
	per: Per;
	/** 0 = the period containing today, -1 = the one before, … Never positive. */
	off: number;
}

export interface Period {
	per: Per;
	off: number;
	start: string;
	/** Last day of the period, inclusive. */
	end: string;
	label: string;
	/** Contains today: the numbers are "so far". */
	live: boolean;
	/** Days counted so far (all of them when the period is over). */
	elapsed: number;
	length: number;
	/** The previous period, cut to the same number of days when this one is live. */
	prev: { start: string; end: string; name: string };
}

const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];
const DAY = 86_400_000;

export function parseDashboardQuery(params: URLSearchParams): DashboardQuery {
	const p = params.get('per');
	const per: Per = p === 'week' || p === 'year' ? p : 'month';
	const off = Math.trunc(Number(params.get('off')));
	return { per, off: Number.isFinite(off) && off < 0 ? Math.max(off, -1000) : 0 };
}

export function dashboardHref({ per, off }: DashboardQuery): string {
	const q = new URLSearchParams();
	if (per !== 'month') q.set('per', per);
	if (off !== 0) q.set('off', String(off));
	const s = q.toString();
	return s ? `/dashboard?${s}` : '/dashboard';
}

const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => toIso(toMs(iso) + n * DAY);
const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY);

/** First and last day of the period `off` steps from the one containing `today`. */
export function rangeFor(per: Per, off: number, today: string): { start: string; end: string } {
	const d = new Date(toMs(today));
	const y = d.getUTCFullYear(),
		m = d.getUTCMonth();
	if (per === 'week') {
		const start = addDays(today, -((d.getUTCDay() + 6) % 7) + 7 * off); // Monday
		return { start, end: addDays(start, 6) };
	}
	if (per === 'month') {
		return { start: toIso(Date.UTC(y, m + off, 1)), end: toIso(Date.UTC(y, m + off + 1, 0)) };
	}
	return { start: toIso(Date.UTC(y + off, 0, 1)), end: toIso(Date.UTC(y + off, 11, 31)) };
}

const short = (iso: string) =>
	`${Number(iso.slice(8))} ${MONTHS[Number(iso.slice(5, 7)) - 1]!.slice(0, 3)}`;

function labelFor(per: Per, start: string, end: string): string {
	const year = start.slice(0, 4);
	if (per === 'year') return year;
	if (per === 'month') return `${MONTHS[Number(start.slice(5, 7)) - 1]} ${year}`;
	if (start.slice(0, 7) === end.slice(0, 7))
		return `${Number(start.slice(8))} – ${short(end)} ${end.slice(0, 4)}`;
	return `${short(start)} – ${short(end)} ${end.slice(0, 4)}`;
}

export function periodFor(per: Per, off: number, today: string): Period {
	const { start, end } = rangeFor(per, off, today);
	const live = end >= today;
	const length = daysBetween(start, end) + 1;
	const elapsed = live ? daysBetween(start, today) + 1 : length;
	const p = rangeFor(per, off - 1, today);
	const prevEnd =
		live && addDays(p.start, elapsed - 1) < p.end ? addDays(p.start, elapsed - 1) : p.end;
	const name =
		per === 'week'
			? off === 0
				? 'last week'
				: 'the week before'
			: per === 'month'
				? MONTHS[Number(p.start.slice(5, 7)) - 1]!
				: p.start.slice(0, 4);
	return {
		per,
		off,
		start,
		end,
		live,
		elapsed,
		length,
		label: labelFor(per, start, end),
		prev: { start: p.start, end: prevEnd, name }
	};
}

/** Whether stepping back still lands on a period that contains a log. */
export const canGoBack = (period: Period, firstLog: string | null) =>
	firstLog !== null && rangeFor(period.per, -1, period.start).end >= firstLog;

/** Today's date in `tz` as "YYYY-MM-DD" ('en-CA' formats that way, as in format.ts todayIso). */
export const todayIn = (tz: string, now = new Date()) =>
	now.toLocaleDateString('en-CA', { timeZone: tz });

/** `tz`'s offset from UTC at instant `ms`, in ms. */
function offsetAt(ms: number, tz: string): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: tz,
		hourCycle: 'h23',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric'
	}).formatToParts(ms);
	const v = (t: string) => Number(parts.find((p) => p.type === t)!.value);
	return (
		Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second')) -
		Math.floor(ms / 1000) * 1000
	);
}

/** The instant local midnight of `iso` begins in `tz`. Re-checks the offset once for DST. */
export function zonedDayStart(iso: string, tz: string): Date {
	const guess = toMs(iso);
	const first = guess - offsetAt(guess, tz);
	return new Date(guess - offsetAt(first, tz));
}
