import { describe, expect, it } from 'vitest';
import { logVisitSchema, MAX_QTY } from './schema.ts';

const TODAY = '2026-10-16';
const schema = logVisitSchema(TODAY);

const valid = {
	date: '2026-10-15',
	place: { kind: 'named', name: 'Brown Coffee' },
	meal: 'lunch',
	dining: 'dine_in',
	items: [{ title: 'Cappuccino', itemType: 'drink', qty: 2, price: 2.75 }],
	overall: 4
};

const fails = (over: object) => expect(schema.safeParse({ ...valid, ...over }).success).toBe(false);

describe('logVisitSchema', () => {
	it('accepts a visit and fills defaults', () => {
		const r = schema.parse(valid);
		expect(r.note).toBeNull();
		expect(r.items[0]).toMatchObject({
			foodTypeId: null,
			drinkTypeId: null,
			cuisineTypeId: null,
			taxPercent: null,
			isFavorite: false
		});
	});
	it('turns a blank note into null and trims', () => {
		expect(schema.parse({ ...valid, note: '   ' }).note).toBeNull();
		expect(schema.parse({ ...valid, note: ' less ice ' }).note).toBe('less ice');
	});
	it('rejects a future or impossible date', () => {
		fails({ date: '2026-10-17' });
		fails({ date: '2026-02-30' });
		fails({ date: '16/10/2026' });
	});
	it('needs a place, and trims a named one', () => {
		fails({ place: { kind: 'named', name: '   ' } });
		fails({ place: { kind: 'existing', placeId: 'nope' } });
		const r = schema.parse({ ...valid, place: { kind: 'named', name: ' Malis ' } });
		expect(r.place).toEqual({ kind: 'named', name: 'Malis' });
	});
	it('needs at least one item, with qty ≥ 1 and a non-negative price', () => {
		fails({ items: [] });
		fails({ items: [{ ...valid.items[0], qty: 0 }] });
		fails({ items: [{ ...valid.items[0], price: -1 }] });
		fails({ items: [{ ...valid.items[0], title: ' ' }] });
	});
	it('takes up to MAX_QTY of one item, where the stepper stops', () => {
		expect(
			schema.safeParse({ ...valid, items: [{ ...valid.items[0], qty: MAX_QTY }] }).success
		).toBe(true);
		fails({ items: [{ ...valid.items[0], qty: MAX_QTY + 1 }] });
	});
	it('accepts a tax percentage but not a negative one', () => {
		const item = { ...valid.items[0], taxPercent: 10, isFavorite: true };
		expect(schema.parse({ ...valid, items: [item] }).items[0]).toMatchObject({
			taxPercent: 10,
			isFavorite: true
		});
		fails({ items: [{ ...item, taxPercent: -1 }] });
	});
	it('needs a whole-star rating from 1 to 5', () => {
		fails({ overall: 0 });
		fails({ overall: 6 });
		fails({ overall: 3.5 });
	});
	it('limits the note to 200 characters', () => fails({ note: 'x'.repeat(201) }));
	it('rejects unknown meals and dining options', () => {
		fails({ meal: 'brunch' });
		fails({ dining: 'drive_through' });
	});
});
