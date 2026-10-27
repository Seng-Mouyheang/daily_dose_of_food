import { describe, expect, it } from 'vitest';
import {
	rankPlaces,
	recentItems,
	searchItems,
	searchPlaces,
	usualAt,
	type HistoryRow
} from './suggest.ts';

const row = (over: Partial<HistoryRow> = {}): HistoryRow => ({
	title: 'Cappuccino',
	itemType: 'drink',
	foodTypeId: null,
	drinkTypeId: 1,
	cuisineTypeId: null,
	kind: 'Coffee',
	cuisine: null,
	place: 'Brown Coffee',
	qty: 1,
	price: 2.75,
	...over
});

describe('rankPlaces', () => {
	const p = (place: string, placeId: string | null = null, address: string | null = null) => ({
		place,
		placeId,
		address
	});
	it('counts visits per place, most visited first', () => {
		const r = rankPlaces([p('Malis'), p('Brown Coffee'), p('Brown Coffee'), p('Brown Coffee')]);
		expect(r.map((x) => [x.name, x.visits])).toEqual([
			['Brown Coffee', 3],
			['Malis', 1]
		]);
	});
	it('treats names case-insensitively and keeps the first spelling', () => {
		const r = rankPlaces([p('Brown Coffee'), p(' brown coffee ')]);
		expect(r).toEqual([{ name: 'Brown Coffee', placeId: null, address: null, visits: 2 }]);
	});
	it('picks up an id and address from a later row', () => {
		const r = rankPlaces([p('Malis'), p('Malis', 'id1', 'Norodom Blvd')]);
		expect(r[0]).toMatchObject({ placeId: 'id1', address: 'Norodom Blvd', visits: 2 });
	});
	it('breaks ties by name', () => {
		expect(rankPlaces([p('B'), p('A')]).map((x) => x.name)).toEqual(['A', 'B']);
	});
});

describe('searchPlaces', () => {
	const places = rankPlaces([
		{ place: 'Artillery Café', placeId: null, address: 'Street 240' },
		{ place: 'Brown Coffee', placeId: null, address: 'Sisowath Quay' },
		{ place: 'Café Brown', placeId: null, address: null }
	]);
	it('matches the name or address, name-prefix first', () => {
		expect(searchPlaces(places, 'brown').map((p) => p.name)).toEqual([
			'Brown Coffee',
			'Café Brown'
		]);
		expect(searchPlaces(places, 'street').map((p) => p.name)).toEqual(['Artillery Café']);
	});
	it('returns nothing for a blank or unmatched query', () => {
		expect(searchPlaces(places, '  ')).toEqual([]);
		expect(searchPlaces(places, 'zzz')).toEqual([]);
	});
	it('caps the list', () => expect(searchPlaces(places, 'a', 2)).toHaveLength(2));
});

describe('usualAt', () => {
	const history = [
		row({ title: 'Cappuccino', price: 3, place: 'Brown Coffee' }),
		row({ title: 'Croissant', itemType: 'food', place: 'Brown Coffee', price: 2.8 }),
		row({ title: 'Cappuccino', price: 2.75, place: 'Brown Coffee' }),
		row({ title: 'Latte', place: 'Tube Coffee' })
	];
	it('ranks by how often, at that place only', () => {
		const r = usualAt(history, 'brown coffee');
		expect(r.map((x) => [x.title, x.uses])).toEqual([
			['Cappuccino', 2],
			['Croissant', 1]
		]);
	});
	it('uses the newest price, per item (history is newest first)', () => {
		expect(usualAt(history, 'Brown Coffee')[0]!.priceEach).toBe(3);
	});
	it('divides a line total by its quantity', () => {
		const r = usualAt([row({ qty: 2, price: 5.5 })], 'Brown Coffee');
		expect(r[0]!.priceEach).toBe(2.75);
	});
	it('is empty for an unknown place', () => expect(usualAt(history, 'Nowhere')).toEqual([]));
	it('caps at five', () => {
		const many = Array.from({ length: 8 }, (_, i) => row({ title: `Item ${i}` }));
		expect(usualAt(many, 'Brown Coffee')).toHaveLength(5);
	});
});

describe('recentItems', () => {
	it('lists the latest distinct items, capped at six', () => {
		const h = [
			row({ title: 'A' }),
			row({ title: 'a' }),
			...['B', 'C', 'D', 'E', 'F', 'G', 'H'].map((title) => row({ title }))
		];
		expect(recentItems(h).map((x) => x.title)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
	});
});

describe('searchItems', () => {
	const h = [
		row({ title: 'Iced Cappuccino' }),
		row({ title: 'Cappuccino' }),
		row({ title: 'Croissant', itemType: 'food' })
	];
	it('matches the name, name-prefix first', () => {
		expect(searchItems(h, 'cappuccino').map((x) => x.title)).toEqual([
			'Cappuccino',
			'Iced Cappuccino'
		]);
	});
	it('keeps the lookup ids and kind for the form', () => {
		expect(searchItems(h, 'iced')[0]).toMatchObject({ drinkTypeId: 1, kind: 'Coffee' });
	});
	it('returns nothing for a blank or unmatched query', () => {
		expect(searchItems(h, '')).toEqual([]);
		expect(searchItems(h, 'pizza')).toEqual([]);
	});
});
