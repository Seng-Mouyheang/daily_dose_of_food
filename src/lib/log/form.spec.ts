import { describe, expect, it } from 'vitest';
import { LogForm, priceOf } from './form.svelte.ts';
import { logVisitSchema } from './schema.ts';
import type { ItemSuggestion } from './suggest.ts';

const cappuccino: ItemSuggestion = {
	title: 'Cappuccino',
	itemType: 'drink',
	foodTypeId: null,
	drinkTypeId: 3,
	cuisineTypeId: null,
	kind: 'Coffee',
	cuisine: null,
	priceEach: 2.75,
	taxPercent: null,
	uses: 4
};
const place = { name: 'Brown Coffee', placeId: null, address: null, visits: 3 };

const filled = () => {
	const f = new LogForm('2026-10-15', 'lunch');
	f.pickPlace(place);
	f.toggle(cappuccino);
	return f;
};

describe('priceOf', () => {
	it('reads a typed price, with a comma or without a number', () => {
		expect(priceOf('2.75')).toBe(2.75);
		expect(priceOf('2,5')).toBe(2.5);
		expect(priceOf('')).toBe(0);
		expect(priceOf('abc')).toBe(0);
	});
});

describe('items', () => {
	it('adds a suggestion at its last price and takes it off again', () => {
		const f = new LogForm('2026-10-15', 'lunch');
		f.toggle(cappuccino);
		expect(f.items[0]).toMatchObject({ title: 'Cappuccino', price: '2.75', qty: 1, custom: false });
		f.toggle({ ...cappuccino, title: ' cappuccino ' });
		expect(f.items).toEqual([]);
	});
	it('adds a new item once, as food, with no price yet', () => {
		const f = new LogForm('2026-10-15', 'lunch');
		f.addNew('  Banh Mi ');
		f.addNew('banh mi');
		f.addNew('   ');
		expect(f.items).toHaveLength(1);
		expect(f.items[0]).toMatchObject({
			title: 'Banh Mi',
			itemType: 'food',
			price: '',
			custom: true
		});
	});
	it('totals price × qty live', () => {
		const f = filled();
		f.items[0]!.qty = 2;
		f.addNew('Croissant');
		f.items[1]!.price = '2.80';
		expect(f.total).toBe(8.3);
		expect(f.tax).toBe(0);
	});
	it('shows the bill as a receipt: subtotal, tax, total', () => {
		const f = filled();
		f.items[0]!.qty = 2;
		expect(f.subtotal).toBe(5.5);
		expect(f.tax).toBe(0);
		f.taxPercent = '10';
		expect(f.subtotal).toBe(5.5);
		expect(f.tax).toBe(0.55);
		expect(f.total).toBe(6.05);
	});
	it('keeps sums exact to the cent', () => {
		const f = filled();
		f.addNew('Latte');
		f.items[0]!.price = '9';
		f.items[0]!.qty = 2;
		f.items[1]!.price = '3.5';
		f.taxPercent = '10';
		expect([f.subtotal, f.tax, f.total]).toEqual([21.5, 2.15, 23.65]);
	});
	it('starts the bill tax at what the item last carried, without overwriting a typed one', () => {
		const f = new LogForm('2026-10-15', 'lunch');
		f.toggle({ ...cappuccino, taxPercent: 10 });
		expect(f.taxPercent).toBe('10');
		expect(f.items[0]).toMatchObject({ isFavorite: false });
		const g = new LogForm('2026-10-15', 'lunch');
		g.taxPercent = '7';
		g.toggle({ ...cappuccino, taxPercent: 10 });
		expect(g.taxPercent).toBe('7');
	});
});

describe('next', () => {
	it('asks for a place first, then for an item', () => {
		const f = new LogForm('2026-10-15', 'lunch');
		expect(f.next()).toBe(false);
		expect(f.error).toBe('place');
		f.pickPlace(place);
		expect(f.error).toBeNull();
		expect(f.next()).toBe(false);
		expect(f.error).toBe('items');
		f.toggle(cappuccino);
		expect(f.next()).toBe(true);
		expect(f.step).toBe(2);
	});
	it('accepts a place typed as text', () => {
		const f = new LogForm('2026-10-15', 'lunch');
		f.addPlace('  New Cafe ');
		expect(f.place).toEqual({ name: 'New Cafe', placeId: null, address: null, visits: 0 });
		f.addPlace('   ');
		expect(f.place?.name).toBe('New Cafe');
	});
});

describe('canSave', () => {
	it('needs a star rating', () => {
		const f = filled();
		expect(f.canSave()).toBe(false);
		expect(f.error).toBe('rate');
		f.overall = 4;
		expect(f.canSave()).toBe(true);
		expect(f.error).toBeNull();
	});
});

describe('payload', () => {
	const today = '2026-10-16';
	it('is accepted by the server schema, with a typed place as text', () => {
		const f = filled();
		f.overall = 4;
		f.note = ' less ice ';
		const r = logVisitSchema(today).safeParse(f.payload());
		expect(r.success).toBe(true);
		expect(r.data).toMatchObject({
			place: { kind: 'named', name: 'Brown Coffee' },
			note: 'less ice',
			items: [{ title: 'Cappuccino', price: 2.75, qty: 1, drinkTypeId: 3 }]
		});
	});
	it('sends a known place by id', () => {
		const f = filled();
		f.pickPlace({ ...place, placeId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' });
		f.overall = 5;
		expect(f.payload().place).toEqual({
			kind: 'existing',
			placeId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
		});
	});
	it('sends the bill tax on every item, and favorites per item', () => {
		const f = filled();
		f.addNew('Croissant');
		f.taxPercent = '10';
		f.items[0]!.isFavorite = true;
		f.overall = 4;
		const [a, b] = f.payload().items;
		expect(a).toMatchObject({ taxPercent: 10, isFavorite: true });
		expect(b).toMatchObject({ taxPercent: 10, isFavorite: false });
		expect(logVisitSchema(today).safeParse(f.payload()).success).toBe(true);
	});
	it('sends no tax when the field is blank', () => {
		const f = filled();
		f.overall = 4;
		expect(f.payload().items[0]!.taxPercent).toBeNull();
	});
	it('treats a blank price as free', () => {
		const f = filled();
		f.items[0]!.price = '';
		f.overall = 3;
		expect(f.payload().items[0]!.price).toBe(0);
	});
});
