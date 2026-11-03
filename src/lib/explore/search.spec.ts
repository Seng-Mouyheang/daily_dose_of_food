import { describe, expect, it } from 'vitest';
import { clipQuote, highlight, normalizeQuery, placeScore, searchActive } from './search.ts';

describe('normalizeQuery / searchActive', () => {
	it('ignores case, accents, spaces and a leading @', () => {
		expect(normalizeQuery('  Pâté ')).toBe('pate');
		expect(normalizeQuery('@Jaiden.Eats')).toBe('jaiden.eats');
		expect(normalizeQuery(null)).toBe('');
	});

	it('starts at 2 characters, not counting the @', () => {
		expect(searchActive('c')).toBe(false);
		expect(searchActive('@j')).toBe(false);
		expect(searchActive(' é ')).toBe(false);
		expect(searchActive('co')).toBe(true);
	});
});

describe('placeScore', () => {
	const addr = 'Sisowath Quay, Phnom Penh';

	it('ranks name start > word start > anywhere > address only', () => {
		expect(placeScore('Brown Coffee Riverside', addr, 'brown')).toBe(4);
		expect(placeScore('Brown Coffee Riverside', addr, 'river')).toBe(3);
		expect(placeScore('Brown Coffee Riverside', addr, 'side')).toBe(2);
		expect(placeScore('Brown Coffee Riverside', addr, 'sisowath')).toBe(1);
		expect(placeScore('Brown Coffee Riverside', addr, 'pizza')).toBe(0);
	});

	it('only counts the address from 4 characters', () => {
		expect(placeScore('Malis', 'Norodom Blvd', 'nor')).toBe(0);
		expect(placeScore('Malis', 'Norodom Blvd', 'noro')).toBe(1);
		expect(placeScore('Malis', null, 'noro')).toBe(0);
	});

	it('ignores accents in the name', () => {
		expect(placeScore('Artillery Café', null, 'cafe')).toBe(3);
	});
});

describe('highlight', () => {
	it('splits around the first match', () => {
		expect(highlight('Iced Latte', 'lat')).toEqual({ before: 'Iced ', match: 'Lat', after: 'te' });
	});

	it('keeps the original spelling of an accented match', () => {
		expect(highlight('Nom Pang Pâté', 'pate')).toEqual({
			before: 'Nom Pang ',
			match: 'Pâté',
			after: ''
		});
	});

	it('handles decomposed accents', () => {
		const text = 'Café Mimi';
		expect(highlight(text, 'mimi')).toEqual({ before: 'Café ', match: 'Mimi', after: '' });
	});

	it('returns everything in before when there is no match', () => {
		expect(highlight('Malis', 'zz')).toEqual({ before: 'Malis', match: '', after: '' });
		expect(highlight('Malis', '')).toEqual({ before: 'Malis', match: '', after: '' });
	});
});

describe('clipQuote', () => {
	it('leaves short text alone', () => {
		expect(clipQuote('Short and sweet.')).toBe('Short and sweet.');
	});

	it('cuts at a word near the limit and ends with an ellipsis', () => {
		const text =
			'Flaky, buttery layers and a vanilla cream that isn’t too sweet. Pricey for the size, but I’d come back for it with a coffee on a slow morning. Ask for a window seat.';
		const out = clipQuote(text);
		expect(out.length).toBeLessThanOrEqual(141);
		expect(out.endsWith('…')).toBe(true);
		expect(text.startsWith(out.slice(0, -1))).toBe(true);
		expect(out).not.toMatch(/[\s,.;:]…$/);
	});

	it('hard-cuts one long word', () => {
		expect(clipQuote('a'.repeat(200), 140)).toBe('a'.repeat(140) + '…');
	});
});
