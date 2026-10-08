import { describe, expect, it } from 'vitest';
import { formatVisitDate, priceWithTax, ratingWord } from './format.ts';

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
