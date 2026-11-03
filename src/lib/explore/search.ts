/**
 * Explore search's pure rules: how a query is normalized and when it counts, how a match is split
 * for highlighting, and how a photo-free tile's quote is cut. Matching and ranking run in SQL
 * (lower + unaccent, explore-search.ts); `fold` mirrors them closely enough to highlight the match.
 */

/** Letters `unaccent` rewrites that NFD doesn't split into a base and a mark. */
const LETTERS: Record<string, string> = {
	ø: 'o',
	ł: 'l',
	đ: 'd',
	ð: 'd',
	þ: 'th',
	æ: 'ae',
	œ: 'oe',
	ß: 'ss',
	ı: 'i'
};

const LETTER = new RegExp(`[${Object.keys(LETTERS).join('')}]`, 'g');

/** Lowercase, accents stripped (é → e, ø → o), like SQL's `unaccent(lower(…))`, so "Pâté" and
 *  "pate" match. */
export function fold(text: string): string {
	return text
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(LETTER, (c) => LETTERS[c]);
}

/** The query as matched: trimmed, folded, a leading @ dropped so "@jaiden" finds a handle. */
export function normalizeQuery(raw: string | null | undefined): string {
	return fold((raw ?? '').trim()).replace(/^@/, '');
}

/** Results start at 2 characters; one letter matches almost everyone. */
export const MIN_QUERY = 2;

export function searchActive(raw: string | null | undefined): boolean {
	return normalizeQuery(raw).length >= MIN_QUERY;
}

/** `text` split around the first match of `q`, for markup without {@html}. Matching is folded,
 *  the parts keep the original spelling ("Pâté" stays "Pâté"). No match: all of it in `before`. */
export function highlight(
	text: string,
	q: string
): { before: string; match: string; after: string } {
	// Folding can change length (a decomposed accent), so match per character, not on the string.
	const folded = [...text].map((c) => fold(c));
	const at = q ? folded.join('').indexOf(q) : -1;
	if (at < 0) return { before: text, match: '', after: '' };
	const chars = [...text];
	let pos = 0;
	let start = -1;
	let end = chars.length;
	for (let i = 0; i < chars.length; i++) {
		// The match starts on the character whose folded text covers `at` (one character can fold
		// to two, like æ → ae). A combining mark folds to '': it belongs to the letter before it, so
		// the match neither starts on one nor ends before one.
		if (start < 0 && pos + folded[i].length > at) start = i;
		pos += folded[i].length;
		if (start >= 0 && pos >= at + q.length) {
			end = i + 1;
			while (end < chars.length && !folded[end]) end++;
			break;
		}
	}
	return {
		before: chars.slice(0, start).join(''),
		match: chars.slice(start, end).join(''),
		after: chars.slice(end).join('')
	};
}

/** A photo-free tile quotes at most ~`max` characters, cut at a word and ended with "…", before
 *  the 4-line clamp. Cutting first keeps the payload and the screen reader text short too. */
export function clipQuote(text: string, max = 140): string {
	if (text.length <= max) return text;
	const space = text.lastIndexOf(' ', max);
	return text.slice(0, space > 80 ? space : max).replace(/[\s,.;:]+$/, '') + '…';
}

export type SearchTab = 'all' | 'food' | 'people' | 'places';

export function parseSearchTab(raw: string | null): SearchTab {
	return raw === 'food' || raw === 'people' || raw === 'places' ? raw : 'all';
}

/** A People row. */
export interface PersonResult {
	id: string;
	displayName: string;
	username: string;
	avatarUrl: string | null;
	bio: string | null;
	reviewCount: number;
	followers: number;
	youFollow: boolean;
}

/** A Places row: the place and its public reviews' average and count. */
export interface PlaceResult {
	id: string;
	name: string;
	address: string | null;
	average: number;
	reviewCount: number;
}
