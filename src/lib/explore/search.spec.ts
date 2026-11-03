import { describe, expect, it } from 'vitest';
import { clipQuote, fold, highlight, normalizeQuery, searchActive } from './search.ts';

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

describe('fold', () => {
	it("folds letters NFD doesn't split, the way unaccent does", () => {
		expect(fold('Smørrebrød')).toBe('smorrebrod');
		expect(fold('Łódź Grill')).toBe('lodz grill');
		expect(fold('Cæsar Straße')).toBe('caesar strasse');
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
		const text = 'Cafe\u0301 Mimi';
		expect(highlight(text, 'mimi')).toEqual({ before: 'Cafe\u0301 ', match: 'Mimi', after: '' });
	});

	it('keeps a decomposed accent with the letter it sits on, at either end of the match', () => {
		expect(highlight('Cafe\u0301 Mimi', 'cafe')).toEqual({
			before: '',
			match: 'Cafe\u0301',
			after: ' Mimi'
		});
		expect(highlight('Cafe\u0301 Mimi', 'e')).toEqual({
			before: 'Caf',
			match: 'e\u0301',
			after: ' Mimi'
		});
		expect(highlight('Cafe\u0301x', 'x')).toEqual({ before: 'Cafe\u0301', match: 'x', after: '' });
	});

	it('highlights letters folded by unaccent, even a match starting inside one', () => {
		expect(highlight('Smørrebrød', 'smorrebrod')).toEqual({
			before: '',
			match: 'Smørrebrød',
			after: ''
		});
		// æ folds to "ae", and "esar" starts on its second letter: the whole æ is highlighted.
		expect(highlight('Cæsar Salad', 'esar')).toEqual({
			before: 'C',
			match: 'æsar',
			after: ' Salad'
		});
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
