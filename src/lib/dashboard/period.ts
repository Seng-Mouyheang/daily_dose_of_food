/**
 * The dashboard's period: Week / Month / Year, stepped back by `off`. All calendar maths runs on
 * plain "YYYY-MM-DD" strings (UTC under the hood, so no DST or server-zone drift); only
 * `zonedDayStart` turns a local date into an instant for SQL. Pure and unit-tested.
 */

export type Per = 'week' | 'month' | 'year' | 'custom';

export interface DashboardQuery {
	per: Per;
	/** 0 = the period containing today, -1 = the one before, … Never positive. */
	off: number;
	/** Custom ranges only: first and last day, inclusive. */
	from?: string;
	to?: string;
}

export interface Period {
	per: Per;
	off: number;
	/** The custom range as picked (before `off` shifts it); custom only. */
	from?: string;
	to?: string;
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

export const MONTHS = [
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

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validIso = (s: string | null): s is string =>
	s !== null && ISO.test(s) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

/** `today` clamps a custom range so it never ends in the future. */
export function parseDashboardQuery(params: URLSearchParams, today: string): DashboardQuery {
	const p = params.get('per');
	const raw = Math.trunc(Number(params.get('off')));
	let off = Number.isFinite(raw) && raw < 0 ? Math.max(raw, -1000) : 0;
	if (p === 'custom') {
		let from = params.get('from'),
			to = params.get('to');
		if (validIso(from) && validIso(to)) {
			if (from > to) [from, to] = [to, from];
			if (to > today) to = today;
			const len = daysBetween(from, to) + 1;
			// A custom range steps by its own length, so cap how far back that can reach (~100 years).
			off = Math.max(off, -Math.ceil(36_500 / len));
			if (len >= 1 && len <= 3660) return { per: 'custom', off, from, to };
		}
		return { per: 'month', off: 0 };
	}
	const per: Per = p === 'week' || p === 'year' ? p : 'month';
	return { per, off };
}

export function dashboardHref({ per, off, from, to }: DashboardQuery): string {
	const q = new URLSearchParams();
	if (per !== 'month') q.set('per', per);
	if (per === 'custom') {
		q.set('from', from!);
		q.set('to', to!);
	}
	if (off !== 0) q.set('off', String(off));
	const s = q.toString();
	return s ? `/dashboard?${s}` : '/dashboard';
}

const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => toIso(toMs(iso) + n * DAY);
export const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY);

/** First and last day of the period `off` steps from the one containing `today`. */
export function rangeFor(
	per: Per,
	off: number,
	today: string,
	custom?: { from: string; to: string }
): { start: string; end: string } {
	if (per === 'custom') {
		const n = (daysBetween(custom!.from, custom!.to) + 1) * off;
		return { start: addDays(custom!.from, n), end: addDays(custom!.to, n) };
	}
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

export const short = (iso: string) =>
	`${Number(iso.slice(8))} ${MONTHS[Number(iso.slice(5, 7)) - 1]!.slice(0, 3)}`;

export function labelFor(per: Per, start: string, end: string): string {
	const year = start.slice(0, 4);
	if (per === 'custom') {
		if (start === end) return `${short(end)} ${end.slice(0, 4)}`;
		if (year !== end.slice(0, 4))
			return `${short(start)} ${year} – ${short(end)} ${end.slice(0, 4)}`;
	}
	if (per === 'year') return year;
	if (per === 'month') return `${MONTHS[Number(start.slice(5, 7)) - 1]} ${year}`;
	if (start.slice(0, 7) === end.slice(0, 7))
		return `${Number(start.slice(8))} – ${short(end)} ${end.slice(0, 4)}`;
	return `${short(start)} – ${short(end)} ${end.slice(0, 4)}`;
}

export function periodFor(
	per: Per,
	off: number,
	today: string,
	custom?: { from: string; to: string }
): Period {
	const { start, end } = rangeFor(per, off, today, custom);
	// A custom range is picked in the past (it ends today at the latest), so it's never "so far".
	const live = per !== 'custom' && end >= today;
	const length = daysBetween(start, end) + 1;
	const elapsed = live ? daysBetween(start, today) + 1 : length;
	const p = rangeFor(per, off - 1, today, custom);
	const prevEnd =
		live && addDays(p.start, elapsed - 1) < p.end ? addDays(p.start, elapsed - 1) : p.end;
	const name =
		per === 'custom'
			? `the ${length} day${length === 1 ? '' : 's'} before`
			: per === 'week'
				? off === 0
					? 'last week'
					: 'the week before'
				: per === 'month'
					? MONTHS[Number(p.start.slice(5, 7)) - 1]!
					: p.start.slice(0, 4);
	return {
		per,
		off,
		...custom,
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
	firstLog !== null &&
	(period.per === 'custom' ? period.prev.end : rangeFor(period.per, -1, period.start).end) >=
		firstLog;

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

/** A month of the picker: blanks before the 1st (weeks start Monday), then every day. */
export function monthGrid(ym: string): { lead: number; days: string[] } {
	const first = `${ym}-01`;
	const lead = (new Date(toMs(first)).getUTCDay() + 6) % 7;
	const n = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
	return { lead, days: Array.from({ length: n }, (_, i) => addDays(first, i)) };
}

export const PRESETS = ['7', '30', '90', 'ytd', 'lastYear'] as const;
export type Preset = (typeof PRESETS)[number];

export function presetRange(k: Preset, today: string): { from: string; to: string } {
	const y = Number(today.slice(0, 4));
	if (k === 'ytd') return { from: `${y}-01-01`, to: today };
	if (k === 'lastYear') return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
	return { from: addDays(today, 1 - Number(k)), to: today };
}

const PRESET_LABEL: Record<Preset, string> = {
	'7': 'Last 7 days',
	'30': 'Last 30 days',
	'90': 'Last 90 days',
	ytd: 'This year',
	lastYear: ''
};
export const presetLabel = (k: Preset, today: string) =>
	k === 'lastYear' ? String(Number(today.slice(0, 4)) - 1) : PRESET_LABEL[k];
