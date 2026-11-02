import { describe, expect, it } from 'vitest';
import { logsOfVisit, logsToReviewDraft, type LinkableLog, type SourceLog } from './review.ts';

const log = (over: Partial<SourceLog> = {}): SourceLog => ({
	loggedOn: '2026-11-01',
	placeName: 'Brown Coffee',
	title: 'Latte',
	itemType: 'drink',
	foodTypeId: null,
	drinkTypeId: 4,
	cuisineTypeId: null,
	qty: 1,
	price: 3.3,
	taxPercent: 10,
	isFavorite: false,
	mealType: 'breakfast',
	visitType: 'dine_in',
	overallRating: 4,
	note: null,
	...over
});

const food = (over: Partial<SourceLog> = {}) =>
	log({
		title: 'Croissant',
		itemType: 'food',
		foodTypeId: 2,
		drinkTypeId: null,
		cuisineTypeId: 7,
		price: 5.5,
		...over
	});

describe('logsToReviewDraft', () => {
	it('carries the visit, the typed place and one drink', () => {
		const d = logsToReviewDraft([log()], null, 'r1');
		expect(d).toMatchObject({
			reviewId: 'r1',
			reviewType: 'beverage',
			visitType: 'dine_in',
			mealType: 'breakfast',
			visitedAt: '2026-11-01',
			newPlaceName: 'Brown Coffee',
			place: null
		});
		expect(d.drink).toMatchObject({
			itemName: 'Latte',
			price: '3',
			taxPercent: '10',
			individualRating: 4,
			drinkTypeId: 4
		});
	});

	it('is a combined review for a dish and a drink, with kind and cuisine', () => {
		const d = logsToReviewDraft([food(), log()], null, 'r1');
		expect(d.reviewType).toBe('both');
		expect(d.dish).toMatchObject({ itemName: 'Croissant', cuisineTypeId: 7, foodTypeIds: [2] });
	});

	it('uses a known place and leaves the typed name empty', () => {
		const place = { id: 'p1', name: 'Brown', addressLine1: null, city: null, distanceMeters: null };
		const d = logsToReviewDraft([log({ placeName: null })], place, 'r1');
		expect(d.place).toEqual(place);
		expect(d.newPlaceName).toBe('');
	});

	it('keeps the quantity in the name so the price is what was paid', () => {
		const d = logsToReviewDraft([log({ qty: 2, price: 6.6 })], null, 'r1');
		expect(d.drink).toMatchObject({ itemName: '2× Latte', price: '6' });
	});

	it('lists extra items under "Also had", after the note', () => {
		const d = logsToReviewDraft(
			[food(), log(), food({ title: 'Brownie', note: 'Great' }), log({ title: 'Tea', qty: 2 })],
			null,
			'r1'
		);
		expect(d.description).toBe('Great\n\nAlso had: Brownie, 2× Tea');
	});

	it('has no description when there is nothing to say', () => {
		expect(logsToReviewDraft([log()], null, 'r1').description).toBe('');
	});
});

describe('logsOfVisit', () => {
	const PLACE = 'c0ffee00-0000-4000-8000-000000000001';
	const OTHER = 'c0ffee00-0000-4000-8000-000000000002';
	const link = (id: string, over: Partial<LinkableLog> = {}): LinkableLog => ({
		...log(),
		id,
		placeId: PLACE,
		...over
	});
	const existing = {
		visitedAt: '2026-11-01T00:00:00.000Z',
		place: { kind: 'existing', placeId: PLACE }
	} as const;

	it('keeps the logs of the reviewed day and place', () => {
		expect(logsOfVisit([link('a'), link('b')], existing)).toEqual(['a', 'b']);
	});
	it('drops logs from another day or another place', () => {
		const logs = [link('a'), link('b', { loggedOn: '2026-10-31' }), link('c', { placeId: OTHER })];
		expect(logsOfVisit(logs, existing)).toEqual(['a']);
	});
	it('lets a typed-in place match the place picked for the review', () => {
		expect(logsOfVisit([link('a', { placeId: null })], existing)).toEqual(['a']);
	});
	it('matches a new place by name, ignoring case', () => {
		const review = {
			visitedAt: existing.visitedAt,
			place: { kind: 'new', name: ' brown coffee ' }
		} as const;
		const logs = [
			link('a', { placeId: null }),
			link('b', { placeId: null, placeName: 'Elsewhere' }),
			link('c')
		];
		expect(logsOfVisit(logs, review)).toEqual(['a']);
	});
});
