import { describe, expect, it } from 'vitest';
import { groupVisits, lineTotal, visitTitle, type LogEntry } from './visits.ts';

let n = 0;
const log = (over: Partial<LogEntry> = {}): LogEntry => ({
	id: `l${++n}`,
	date: '2026-10-15',
	place: 'Brown Coffee',
	title: 'Cappuccino',
	itemType: 'drink',
	qty: 1,
	price: 2.75,
	meal: 'lunch',
	dining: 'dine_in',
	overall: 4,
	note: null,
	reviewId: null,
	...over
});

describe('groupVisits', () => {
	it('groups logs that share date, meal, place and dining', () => {
		const v = groupVisits([
			log(),
			log({ title: 'Croissant', itemType: 'food', price: 2.8, overall: 5 }),
			log({ meal: 'dinner' })
		]);
		expect(v).toHaveLength(2);
		expect(v[0]).toMatchObject({ meal: 'lunch', price: 5.55, overall: 4.5, drink: false });
		expect(v[1]).toMatchObject({ meal: 'dinner', drink: true });
	});
	it('splits on place, dining and date', () => {
		expect(
			groupVisits([
				log(),
				log({ place: 'Malis' }),
				log({ dining: 'takeaway' }),
				log({ date: '2026-10-14' })
			])
		).toHaveLength(4);
	});
	it('keeps a review as its own visit', () => {
		const v = groupVisits([log(), log({ reviewId: 'r1' })]);
		expect(v).toHaveLength(2);
		expect(v[1]!.reviewId).toBe('r1');
	});
	it('sums prices to the cent', () => {
		expect(groupVisits([log({ price: 0.1 }), log({ price: 0.2 })])[0]!.price).toBe(0.3);
	});
	it('is empty for no logs', () => expect(groupVisits([])).toEqual([]));
});

describe('visitTitle', () => {
	const t = (title: string, qty = 1) => ({ title, qty });
	it('joins two items and shows a quantity', () => {
		expect(visitTitle([t('Cappuccino', 2), t('Croissant')])).toBe('2× Cappuccino & Croissant');
	});
	it('collapses beyond two', () => {
		expect(visitTitle([t('A'), t('B'), t('C'), t('D')])).toBe('A, B +2 more');
	});
	it('handles one item', () => expect(visitTitle([t('Tea')])).toBe('Tea'));
});

describe('lineTotal', () => {
	it('is price each × qty, to the cent', () => {
		expect(lineTotal(2.75, 2)).toBe(5.5);
		expect(lineTotal(0.1, 3)).toBe(0.3);
	});
	it('adds tax as a percentage', () => {
		expect(lineTotal(2.75, 2, 10)).toBe(6.05);
		expect(lineTotal(2.75, 2, 0)).toBe(5.5);
	});
});
