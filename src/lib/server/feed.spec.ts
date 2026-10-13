import { describe, expect, it } from 'vitest';
import { canViewReview, decodeCursor, encodeCursor, groupBy } from './feed.ts';

describe('groupBy', () => {
	it('collects rows under their key, preserving order within a group', () => {
		const rows = [
			{ reviewId: 'a', url: '1.jpg' },
			{ reviewId: 'b', url: '2.jpg' },
			{ reviewId: 'a', url: '3.jpg' }
		];
		const grouped = groupBy(
			rows,
			(r) => r.reviewId,
			(r) => r.url
		);
		expect([...grouped.keys()]).toEqual(['a', 'b']);
		expect(grouped.get('a')).toEqual(['1.jpg', '3.jpg']);
		expect(grouped.get('b')).toEqual(['2.jpg']);
	});

	it('drops the grouping key from the projected rows', () => {
		const grouped = groupBy(
			[{ reviewId: 'a', label: 'Fresh' }],
			(r) => r.reviewId,
			(r) => ({ label: r.label })
		);
		expect(grouped.get('a')).toEqual([{ label: 'Fresh' }]);
	});

	it('returns an empty map for no rows, so a review with no children reads as []', () => {
		const grouped = groupBy(
			[] as { reviewId: string }[],
			(r) => r.reviewId,
			(r) => r
		);
		expect(grouped.size).toBe(0);
		expect(grouped.get('a') ?? []).toEqual([]);
	});
});

describe('feed cursor', () => {
	const cursor = {
		publishedAt: '2026-10-09T12:00:00.000Z',
		id: 'c0ffee00-0000-4000-8000-000000000001'
	};

	it('round-trips', () => {
		expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
	});

	it.each([
		['missing', null],
		['empty', ''],
		['no separator', '2026-10-09T12:00:00.000Z'],
		['no timestamp', '_abc'],
		['no id', '2026-10-09T12:00:00.000Z_'],
		['unparseable timestamp', 'yesterday_abc'],
		['a timestamp mangled by an extra separator', '2026-10-09T12:00:00.000Z_abc_def']
	])('treats a %s cursor as page one', (_label, raw) => {
		expect(decodeCursor(raw)).toBeNull();
	});
});

describe('canViewReview', () => {
	const published = {
		visibility: 'public',
		reviewStatus: 'published',
		deletedAt: null,
		userId: 'author'
	};

	it('lets anyone, signed in or not, see a public published review', () => {
		expect(canViewReview(published, null)).toBe(true);
		expect(canViewReview(published, 'someone-else')).toBe(true);
	});

	it.each([
		['private', { visibility: 'private' }],
		['friends (until follows exist)', { visibility: 'friends' }],
		['draft', { reviewStatus: 'draft' }],
		['hidden by moderation', { reviewStatus: 'hidden' }],
		['soft-deleted', { deletedAt: new Date() }]
	])('hides a %s review from everyone but its author', (_label, override) => {
		const row = { ...published, ...override };
		expect(canViewReview(row, null)).toBe(false);
		expect(canViewReview(row, 'someone-else')).toBe(false);
		expect(canViewReview(row, 'author')).toBe(true);
	});

	it('never treats a signed-out viewer as the author', () => {
		expect(canViewReview({ ...published, visibility: 'private' }, null)).toBe(false);
	});
});
