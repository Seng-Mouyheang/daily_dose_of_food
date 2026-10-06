/** Small display-formatting helpers shared by the review wizard and its preview card. Pure
 *  functions only — no state, no DOM. */

/** "2026-07-28" -> "28 Jul 2026". Falls back to the raw input if it doesn't parse, so a
 *  malformed draft value never throws mid-render. */
export function formatVisitDate(iso: string): string {
	const date = new Date(`${iso}T00:00:00`);
	if (Number.isNaN(date.getTime())) return iso;
	return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const RATING_WORDS = ['Poor', 'Fair', 'Good', 'Great', 'Excellent'] as const;

/** 1-5 (fractional allowed) -> its nearest star word, or null when there's no rating yet. */
export function ratingWord(value: number | null): string | null {
	if (value === null) return null;
	const index = Math.min(5, Math.max(1, Math.round(value))) - 1;
	return RATING_WORDS[index] ?? null;
}

/** Parses a raw price string + tax percent string (as kept on ItemDraft, so a half-typed
 *  "7." doesn't get coerced mid-edit) into the total. Returns 0 when price doesn't parse. */
export function priceWithTax(price: string, taxPercent: string): number {
	const p = parseFloat(price.replace(',', '.'));
	const tax = parseFloat(taxPercent.replace(',', '.'));
	if (!Number.isFinite(p)) return 0;
	return p * (1 + (Number.isFinite(tax) ? tax : 0) / 100);
}
