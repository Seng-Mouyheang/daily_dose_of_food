import { describe, expect, it } from 'vitest';
import { reviewItemToEntry, toLogEntry } from './logs.ts';

describe('toLogEntry', () => {
	it('maps a log row to an entry with a numeric price and no review', () => {
		expect(
			toLogEntry({
				id: 'l1',
				loggedOn: '2026-10-15',
				place: 'Brown Coffee',
				title: 'Cappuccino',
				itemType: 'drink',
				qty: 2,
				price: '5.50',
				taxPercent: '10.00',
				isFavorite: true,
				mealType: 'lunch',
				visitType: 'dine_in',
				overallRating: 4,
				note: 'less ice'
			})
		).toEqual({
			id: 'l1',
			date: '2026-10-15',
			place: 'Brown Coffee',
			title: 'Cappuccino',
			itemType: 'drink',
			qty: 2,
			price: 5.5,
			taxPercent: 10,
			isFavorite: true,
			meal: 'lunch',
			dining: 'dine_in',
			overall: 4,
			note: 'less ice',
			reviewId: null
		});
	});
});

describe('reviewItemToEntry', () => {
	const review = {
		reviewId: 'r1',
		// 23:30 UTC on the 15th is already the 16th in Phnom Penh (UTC+7)
		visitedAt: new Date('2026-10-15T23:30:00Z'),
		placeName: 'Malis',
		visitType: 'dine_in',
		mealType: 'dinner' as string | null,
		overall: '4.5'
	};
	const item = {
		id: 'i1',
		itemType: 'food',
		itemName: 'Fish Amok',
		price: '9.00',
		taxPercent: '10.00'
	};

	it('files the review under the viewer-local day and carries its id', () => {
		const e = reviewItemToEntry(review, item, 'Asia/Phnom_Penh');
		expect(e).toMatchObject({ date: '2026-10-16', reviewId: 'r1', place: 'Malis', overall: 4.5 });
		expect(reviewItemToEntry(review, item, 'UTC').date).toBe('2026-10-15');
	});
	it('adds tax to the price, as the dashboard does', () => {
		expect(reviewItemToEntry(review, item, 'UTC').price).toBeCloseTo(9.9);
	});
	it('treats a missing price as free', () => {
		expect(reviewItemToEntry(review, { ...item, price: null, taxPercent: null }, 'UTC').price).toBe(
			0
		);
	});
	it('files a drink-only review under snack', () => {
		expect(reviewItemToEntry({ ...review, mealType: null }, item, 'UTC').meal).toBe('snack');
	});
	it('maps drive-through to takeaway and other to dine-in', () => {
		expect(reviewItemToEntry({ ...review, visitType: 'drive_through' }, item, 'UTC').dining).toBe(
			'takeaway'
		);
		expect(reviewItemToEntry({ ...review, visitType: 'other' }, item, 'UTC').dining).toBe(
			'dine_in'
		);
	});
});
