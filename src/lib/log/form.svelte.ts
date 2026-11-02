/**
 * The state of the Log a visit form, and the rules the two steps share. Step 1 picks the date,
 * place and items; step 2 adds meal, dining option, what was paid, a rating and a note. Kept out
 * of the components so the rules (what Continue checks, what a save sends) are unit-tested.
 */
import type { LogVisitInput } from './schema.ts';
import type { ItemSuggestion, PlaceSuggestion } from './suggest.ts';
import { lineTotal, type DiningType, type MealType } from './visits.ts';

export interface PickedItem {
	title: string;
	itemType: 'food' | 'drink';
	foodTypeId: number | null;
	drinkTypeId: number | null;
	cuisineTypeId: number | null;
	/** Dish or drink type, for the "Cuisine · Kind" line; null for something new */
	kind: string | null;
	cuisine: string | null;
	qty: number;
	/** Price of one before tax, as typed ("" counts as 0) */
	price: string;
	isFavorite: boolean;
	/** Typed by the person rather than picked from history: they choose food or drink */
	custom: boolean;
}

export type FormError = 'place' | 'items' | 'rate';

export const priceOf = (s: string) => {
	const n = Number.parseFloat(s.replace(',', '.'));
	return Number.isNaN(n) ? 0 : n;
};

const cents = (n: number) => Math.round(n * 100) / 100;
const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export class LogForm {
	step = $state<1 | 2>(1);
	date = $state('');
	place = $state<PlaceSuggestion | null>(null);
	items = $state<PickedItem[]>([]);
	meal = $state<MealType>('lunch');
	dining = $state<DiningType>('dine_in');
	overall = $state<number | null>(null);
	note = $state('');
	/** Tax on the whole bill as a percentage, as typed ("" means none). Applied to every item. */
	taxPercent = $state('');
	error = $state<FormError | null>(null);

	constructor(date: string, meal: MealType) {
		this.date = date;
		this.meal = meal;
	}

	/** Sum of price × qty over the items, to the cent */
	/** The bill before tax: price × qty for each item */
	subtotal = $derived(
		cents(this.items.reduce((t, i) => t + lineTotal(priceOf(i.price), i.qty), 0))
	);
	/** What was paid: each line with the bill's tax on it, as it is saved */
	total = $derived(
		cents(
			this.items.reduce(
				(t, i) => t + lineTotal(priceOf(i.price), i.qty, priceOf(this.taxPercent)),
				0
			)
		)
	);
	tax = $derived(cents(this.total - this.subtotal));

	has(title: string) {
		return this.items.some((i) => sameTitle(i.title, title));
	}

	/** Adds a suggestion at the price you last paid, or takes it off again */
	toggle(s: ItemSuggestion) {
		if (this.has(s.title)) {
			this.items = this.items.filter((i) => !sameTitle(i.title, s.title));
			return;
		}
		this.items.push({
			title: s.title,
			itemType: s.itemType,
			foodTypeId: s.foodTypeId,
			drinkTypeId: s.drinkTypeId,
			cuisineTypeId: s.cuisineTypeId,
			kind: s.kind,
			cuisine: s.cuisine,
			qty: 1,
			price: s.priceEach.toFixed(2),
			isFavorite: false,
			custom: false
		});
		// The tax a place charged last time is what it will charge now; never overwrite a typed one.
		if (!this.taxPercent.trim() && s.taxPercent) this.taxPercent = String(s.taxPercent);
		if (this.error === 'items') this.error = null;
	}

	/** Something not in your history yet: food until you flip it, priced on step 2 */
	addNew(title: string) {
		const t = title.trim();
		if (!t || this.has(t)) return;
		this.items.push({
			title: t,
			itemType: 'food',
			foodTypeId: null,
			drinkTypeId: null,
			cuisineTypeId: null,
			kind: null,
			cuisine: null,
			qty: 1,
			price: '',
			isFavorite: false,
			custom: true
		});
		if (this.error === 'items') this.error = null;
	}

	pickPlace(place: PlaceSuggestion | null) {
		this.place = place;
		if (place && this.error === 'place') this.error = null;
	}

	/** A place typed in the form: text only until the visit becomes a review */
	addPlace(name: string) {
		const n = name.trim();
		if (n) this.pickPlace({ name: n, placeId: null, address: null, visits: 0 });
	}

	/** Step 1 → 2. False, with the first problem in `error`, when something is missing. */
	next(): boolean {
		this.error = !this.place ? 'place' : this.items.length === 0 ? 'items' : null;
		if (this.error) return false;
		this.step = 2;
		return true;
	}

	/** Whether step 2 can be saved: it needs a rating to count in your averages */
	canSave(): boolean {
		this.error = this.overall ? null : 'rate';
		return this.error === null;
	}

	/** What the save action receives; the server checks it again. */
	payload(): Omit<LogVisitInput, 'note'> & { note: string } {
		const place = this.place!;
		return {
			date: this.date,
			place: place.placeId
				? { kind: 'existing', placeId: place.placeId }
				: { kind: 'named', name: place.name },
			meal: this.meal,
			dining: this.dining,
			items: this.items.map((i) => ({
				title: i.title,
				itemType: i.itemType,
				foodTypeId: i.foodTypeId,
				drinkTypeId: i.drinkTypeId,
				cuisineTypeId: i.cuisineTypeId,
				qty: i.qty,
				price: priceOf(i.price),
				taxPercent: this.taxPercent.trim() ? priceOf(this.taxPercent) : null,
				isFavorite: i.isFavorite
			})),
			overall: this.overall!,
			note: this.note
		};
	}
}
