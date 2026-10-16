import { describe, expect, it } from 'vitest';
import {
	canGoBack,
	monthGrid,
	presetRange,
	dashboardHref,
	parseDashboardQuery,
	periodFor,
	todayIn,
	zonedDayStart
} from './period.ts';

const q = (s: string) => parseDashboardQuery(new URLSearchParams(s), '2026-10-16');

describe('parseDashboardQuery', () => {
	it('defaults to this month', () => expect(q('')).toEqual({ per: 'month', off: 0 }));
	it('rejects unknown periods and future offsets', () => {
		expect(q('per=decade&off=3')).toEqual({ per: 'month', off: 0 });
		expect(q('per=week&off=abc')).toEqual({ per: 'week', off: 0 });
		expect(q('per=year&off=-2.7')).toEqual({ per: 'year', off: -2 });
	});
	it('round-trips through dashboardHref', () => {
		expect(dashboardHref({ per: 'month', off: 0 })).toBe('/dashboard');
		expect(q(dashboardHref({ per: 'week', off: -3 }).split('?')[1]!)).toEqual({
			per: 'week',
			off: -3
		});
	});
});

describe('periodFor', () => {
	it('compares a live month with the same days of the last one', () => {
		const p = periodFor('month', 0, '2026-10-16');
		expect(p).toMatchObject({
			start: '2026-10-01',
			end: '2026-10-31',
			live: true,
			elapsed: 16,
			length: 31,
			label: 'October 2026'
		});
		expect(p.prev).toEqual({ start: '2026-09-01', end: '2026-09-16', name: 'September' });
	});
	it('caps the comparison at the end of a shorter previous month', () => {
		expect(periodFor('month', 0, '2026-10-31').prev.end).toBe('2026-09-30');
		expect(periodFor('month', 0, '2024-03-31').prev.end).toBe('2024-02-29');
	});
	it('compares a finished period whole', () => {
		const p = periodFor('month', -1, '2026-10-16');
		expect(p).toMatchObject({ start: '2026-09-01', end: '2026-09-30', live: false, elapsed: 30 });
		expect(p.prev).toEqual({ start: '2026-08-01', end: '2026-08-31', name: 'August' });
	});
	it('starts weeks on Monday, across a year boundary', () => {
		const p = periodFor('week', 0, '2026-01-01'); // a Thursday
		expect(p).toMatchObject({
			start: '2025-12-29',
			end: '2026-01-04',
			elapsed: 4,
			label: '29 Dec – 4 Jan 2026'
		});
		expect(p.prev.name).toBe('last week');
		expect(periodFor('week', 0, '2026-10-16').label).toBe('12 – 18 Oct 2026');
	});
	it('handles years', () => {
		const p = periodFor('year', -1, '2026-10-16');
		expect(p).toMatchObject({ start: '2025-01-01', end: '2025-12-31', label: '2025', length: 365 });
		expect(p.prev.name).toBe('2024');
	});
});

describe('canGoBack', () => {
	it('stops at the period holding the first log', () => {
		expect(canGoBack(periodFor('month', 0, '2026-10-16'), '2026-09-20')).toBe(true);
		expect(canGoBack(periodFor('month', -1, '2026-10-16'), '2026-09-20')).toBe(false);
		expect(canGoBack(periodFor('month', 0, '2026-10-16'), null)).toBe(false);
		// From two months back (August), July still holds a log.
		expect(canGoBack(periodFor('month', -2, '2026-10-16'), '2026-07-10')).toBe(true);
		expect(canGoBack(periodFor('month', -3, '2026-10-16'), '2026-07-10')).toBe(false);
	});
});

describe('time zones', () => {
	it('finds local midnight', () => {
		expect(zonedDayStart('2026-10-16', 'Asia/Phnom_Penh').toISOString()).toBe(
			'2026-10-15T17:00:00.000Z'
		);
		expect(zonedDayStart('2026-03-08', 'America/New_York').toISOString()).toBe(
			'2026-03-08T05:00:00.000Z'
		);
		expect(zonedDayStart('2026-03-09', 'America/New_York').toISOString()).toBe(
			'2026-03-09T04:00:00.000Z'
		);
	});
	it('reads today in the given zone', () => {
		expect(todayIn('Asia/Phnom_Penh', new Date('2026-10-15T18:00:00Z'))).toBe('2026-10-16');
	});
});

describe('custom ranges', () => {
	const c = { from: '2026-09-08', to: '2026-10-05' };
	it('parses, swaps, clamps and rejects', () => {
		expect(q('per=custom&from=2026-09-08&to=2026-10-05')).toEqual({ per: 'custom', off: 0, ...c });
		expect(q('per=custom&from=2026-10-05&to=2026-09-08&off=-1')).toMatchObject({ ...c, off: -1 });
		expect(q('per=custom&from=2026-10-10&to=2026-12-01').to).toBe('2026-10-16');
		expect(q('per=custom&from=2026-02-30&to=2026-03-01')).toEqual({ per: 'month', off: 0 });
		expect(q('per=custom&from=2026-11-01&to=2026-11-05')).toEqual({ per: 'month', off: 0 });
		expect(q(dashboardHref({ per: 'custom', off: -2, ...c }).split('?')[1]!)).toEqual({
			per: 'custom',
			off: -2,
			...c
		});
	});
	it('caps how far back a custom range can step', () => {
		const r = q('per=custom&from=2016-10-16&to=2026-10-16&off=-1000');
		expect(r.off).toBeGreaterThan(-12); // ~100 years of 3,653-day steps
		expect(q('per=custom&from=2026-11-01&to=2026-11-05').per).toBe('month');
	});
	it('labels, compares with the days before and is never live', () => {
		const p = periodFor('custom', 0, '2026-10-16', c);
		expect(p).toMatchObject({ label: '8 Sep – 5 Oct 2026', length: 28, live: false, elapsed: 28 });
		expect(p.prev).toEqual({ start: '2026-08-11', end: '2026-09-07', name: 'the 28 days before' });
		expect(
			periodFor('custom', 0, '2026-10-16', { from: '2026-10-05', to: '2026-10-05' }).label
		).toBe('5 Oct 2026');
		expect(
			periodFor('custom', 0, '2026-10-16', { from: '2025-12-29', to: '2026-01-04' }).label
		).toBe('29 Dec 2025 – 4 Jan 2026');
	});
	it('steps by its own length and stops at the first log', () => {
		expect(periodFor('custom', -1, '2026-10-16', c)).toMatchObject({
			start: '2026-08-11',
			end: '2026-09-07'
		});
		expect(canGoBack(periodFor('custom', 0, '2026-10-16', c), '2026-09-01')).toBe(true);
		expect(canGoBack(periodFor('custom', 0, '2026-10-16', c), '2026-09-08')).toBe(false);
	});
	it('builds Monday-first months and presets', () => {
		expect(monthGrid('2026-11').lead).toBe(6); // 1 Nov 2026 is a Sunday
		expect(monthGrid('2024-02').days).toHaveLength(29);
		expect(presetRange('30', '2026-10-16')).toEqual({ from: '2026-09-17', to: '2026-10-16' });
		expect(presetRange('lastYear', '2026-10-16')).toEqual({ from: '2025-01-01', to: '2025-12-31' });
	});
});
