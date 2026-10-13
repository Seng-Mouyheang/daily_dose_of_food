import { describe, expect, it } from 'vitest';
import {
	formatCount,
	formatVisitDate,
	greetingFor,
	priceWithTax,
	ratingWord,
	timeAgo
} from './format.ts';

describe('formatVisitDate', () => {
	it('formats an ISO date as "D Mon YYYY"', () => {
		expect(formatVisitDate('2026-07-28')).toBe('28 Jul 2026');
	});

	it('falls back to the raw input when unparseable', () => {
		expect(formatVisitDate('not-a-date')).toBe('not-a-date');
	});
});

describe('ratingWord', () => {
	it('returns null when there is no rating', () => {
		expect(ratingWord(null)).toBeNull();
	});

	it.each([
		[1, 'Poor'],
		[2, 'Fair'],
		[3, 'Good'],
		[4, 'Great'],
		[5, 'Excellent']
	])('maps %d to %s', (value, word) => {
		expect(ratingWord(value)).toBe(word);
	});

	it('rounds fractional values to the nearest word', () => {
		expect(ratingWord(3.5)).toBe('Great');
		expect(ratingWord(4.4)).toBe('Great');
	});

	it('clamps out-of-range values', () => {
		expect(ratingWord(0.2)).toBe('Poor');
		expect(ratingWord(5.9)).toBe('Excellent');
	});
});

describe('priceWithTax', () => {
	it('applies tax percent to the price', () => {
		expect(priceWithTax('6.50', '8')).toBeCloseTo(7.02, 2);
	});

	it('returns 0 when price does not parse', () => {
		expect(priceWithTax('', '8')).toBe(0);
	});

	it('ignores an unparsable tax', () => {
		expect(priceWithTax('10', '')).toBe(10);
	});
});

describe('timeAgo', () => {
	const now = new Date('2026-10-09T12:00:00Z');

	it.each([
		['2026-10-09T11:59:30Z', 'Just now'],
		['2026-10-09T11:45:00Z', '15m ago'],
		['2026-10-09T10:00:00Z', '2h ago'],
		['2026-10-08T10:00:00Z', 'Yesterday'],
		['2026-10-06T12:00:00Z', '3d ago']
	])('renders %s as %s', (iso, expected) => {
		expect(timeAgo(iso, now)).toBe(expected);
	});

	it('switches to an absolute date once it is a week old', () => {
		expect(timeAgo('2026-09-28T12:00:00Z', now)).toBe('28 Sept 2026');
	});

	it('reads a future timestamp as "Just now" rather than a negative age', () => {
		expect(timeAgo('2026-10-09T12:00:20Z', now)).toBe('Just now');
	});

	it('returns an empty string for an unparseable timestamp', () => {
		expect(timeAgo('not-a-date', now)).toBe('');
	});
});

describe('greetingFor', () => {
	// Constructed from local parts, not an ISO instant: the function reads local hours, which is
	// the whole point of it taking the date rather than reading the clock itself.
	const at = (hour: number) => new Date(2026, 9, 9, hour, 0, 0);

	it.each([
		[0, 'Good morning'],
		[11, 'Good morning'],
		[12, 'Good afternoon'],
		[17, 'Good afternoon'],
		[18, 'Good evening'],
		[23, 'Good evening']
	])('greets %d:00 with "%s"', (hour, expected) => {
		expect(greetingFor(at(hour))).toBe(expected);
	});
});

describe('formatCount', () => {
	it.each([
		[0, '0'],
		[950, '950'],
		[1000, '1K'],
		[1200, '1.2K'],
		[1999, '1.9K'],
		[12500, '12.5K'],
		[999_999, '999.9K'],
		[1_000_000, '1M'],
		[2_500_000, '2.5M']
	])('formats %d as %s', (n, expected) => {
		expect(formatCount(n)).toBe(expected);
	});
});
