import { describe, expect, it } from 'vitest';
import {
	decodeJournalCursor,
	encodeJournalCursor,
	journalHref,
	parseJournalQuery,
	type JournalQuery
} from './query.ts';

const ID = '3f1b2c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d';
const parse = (qs: string) => parseJournalQuery(new URLSearchParams(qs));

describe('parseJournalQuery', () => {
	it('defaults to My reviews, newest, all, nothing else', () => {
		expect(parse('')).toEqual({
			tab: 'reviews',
			q: '',
			sort: 'newest',
			filter: 'all',
			archived: false,
			cursor: null,
			selected: null
		});
	});

	it('reads every param', () => {
		const q = parse(`tab=bookmarks&q=%20amok%20&sort=top&filter=drinks&selected=${ID}`);
		expect(q).toMatchObject({
			tab: 'bookmarks',
			q: 'amok',
			sort: 'top',
			filter: 'drinks',
			selected: ID
		});
	});

	it('falls back on junk instead of failing', () => {
		expect(parse('tab=x&sort=y&filter=z&selected=nope&cursor=%%%')).toMatchObject({
			tab: 'reviews',
			sort: 'newest',
			filter: 'all',
			selected: null,
			cursor: null
		});
	});

	it('only honours archived on My reviews', () => {
		expect(parse('archived=1').archived).toBe(true);
		expect(parse('tab=bookmarks&archived=1').archived).toBe(false);
	});

	it('caps the search text', () => {
		expect(parse(`q=${'a'.repeat(300)}`).q).toHaveLength(100);
	});
});

describe('journal cursor', () => {
	it('round-trips both shapes', () => {
		const newest = { t: '2026-10-08T09:00:00.000Z', id: ID };
		const top = { ...newest, v: 4.5 };
		expect(decodeJournalCursor(encodeJournalCursor(newest))).toEqual(newest);
		expect(decodeJournalCursor(encodeJournalCursor(top))).toEqual(top);
	});

	it('rejects tampered cursors', () => {
		expect(decodeJournalCursor(null)).toBeNull();
		expect(decodeJournalCursor('not-base64-json')).toBeNull();
		expect(decodeJournalCursor(encodeJournalCursor({ t: 'yesterday', id: ID }))).toBeNull();
		expect(
			decodeJournalCursor(encodeJournalCursor({ t: '2026-10-08T09:00:00.000Z', id: 'x' }))
		).toBeNull();
	});
});

describe('journalHref', () => {
	const base: JournalQuery = parse('');

	it('keeps the plain tab URLs clean', () => {
		expect(journalHref(base)).toBe('/journal');
		expect(journalHref(base, { tab: 'bookmarks' })).toBe('/journal?tab=bookmarks');
	});

	it('keeps other params when one changes, and drops the cursor', () => {
		const q = { ...parse('q=amok&sort=top'), cursor: { t: '2026-10-08T09:00:00.000Z', id: ID } };
		expect(journalHref(q, { filter: 'favorites' })).toBe(
			'/journal?q=amok&sort=top&filter=favorites'
		);
	});

	it('resets tab-specific state when switching tab, but keeps the sort', () => {
		const q = parse(`archived=1&q=amok&filter=dishes&sort=top&selected=${ID}`);
		expect(journalHref(q, { tab: 'bookmarks' })).toBe('/journal?tab=bookmarks&sort=top');
	});

	it('writes a cursor when given one', () => {
		expect(journalHref(base, { cursor: 'abc' })).toBe('/journal?cursor=abc');
	});
});
