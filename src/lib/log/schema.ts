import { z } from 'zod';
import { DINING_OPTIONS, MEALS } from './visits.ts';

/**
 * Shared between the Log a visit form (step validation) and the save action (authoritative).
 * The form sends the price of one item; the server stores the line total (price × qty).
 */

const lookupId = z.number().int().positive().nullable().default(null);

export const logItemSchema = z.object({
	title: z.string().trim().min(1).max(200),
	itemType: z.enum(['food', 'drink']),
	foodTypeId: lookupId,
	drinkTypeId: lookupId,
	cuisineTypeId: lookupId,
	qty: z.number().int().min(1).max(99),
	/** Price of one item */
	price: z.number().nonnegative().max(1_000_000)
});

/** A place already in the app, or just a name: places need coordinates, which the quick log
 *  doesn't ask for, so a new place stays text until the visit becomes a review. */
export const logPlaceSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('existing'), placeId: z.uuid() }),
	z.object({ kind: z.literal('named'), name: z.string().trim().min(1).max(200) })
]);

const isoDay = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.refine((s) => {
		const ms = Date.parse(`${s}T00:00:00Z`);
		return !Number.isNaN(ms) && new Date(ms).toISOString().startsWith(s);
	}, 'Not a real date');

/** `today` is the user's local date: a visit can't be logged in the future. */
export const logVisitSchema = (today: string) =>
	z.object({
		date: isoDay.refine((d) => d <= today, 'You can only log up to today.'),
		place: logPlaceSchema,
		meal: z.enum(MEALS),
		dining: z.enum(DINING_OPTIONS),
		items: z.array(logItemSchema).min(1).max(20),
		overall: z.number().int().min(1).max(5),
		note: z
			.string()
			.trim()
			.max(200)
			.transform((s) => s || null)
			.nullable()
			.default(null)
	});

export type LogItemInput = z.infer<typeof logItemSchema>;
export type LogPlaceInput = z.infer<typeof logPlaceSchema>;
export type LogVisitInput = z.infer<ReturnType<typeof logVisitSchema>>;
