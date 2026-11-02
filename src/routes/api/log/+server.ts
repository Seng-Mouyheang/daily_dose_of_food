import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { DINING_OPTIONS, MEALS } from '#lib/log/visits.ts';
import { requireUser } from '#lib/server/auth.ts';
import { deleteLogs, restoreLogs } from '#lib/server/logs.ts';
import type { RequestHandler } from './$types';

const idsSchema = z.object({ ids: z.array(z.uuid()).min(1).max(50) });

const lookupId = z.number().int().positive().nullable();
/** Fits numeric(12, 2) */
const money = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/);
/** Fits numeric(5, 2) */
const percent = z.string().regex(/^\d{1,3}(\.\d{1,2})?$/);

const isoDay = z.string().refine((s) => {
	const ms = Date.parse(`${s}T00:00:00Z`);
	return (
		/^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(ms) && new Date(ms).toISOString().startsWith(s)
	);
}, 'Not a real date');

/** A row as DELETE handed it back. Checked so a bad body is a 400, not a database error; the
 *  owner and review link are never taken from it. */
const rowsSchema = z.object({
	rows: z
		.array(
			z
				.object({
					id: z.uuid(),
					loggedOn: isoDay,
					placeId: z.uuid().nullable(),
					placeName: z.string().max(200).nullable(),
					title: z.string().min(1).max(200),
					itemType: z.enum(['food', 'drink']),
					foodTypeId: lookupId,
					drinkTypeId: lookupId,
					cuisineTypeId: lookupId,
					qty: z.number().int().min(1).max(99),
					price: money,
					taxPercent: percent.nullable(),
					isFavorite: z.boolean(),
					mealType: z.enum(MEALS),
					visitType: z.enum(DINING_OPTIONS),
					overallRating: z.number().int().min(1).max(5),
					note: z.string().max(200).nullable(),
					createdAt: z.coerce.date()
				})
				.refine((r) => r.placeId !== null || r.placeName !== null, 'A log needs a place')
		)
		.min(1)
		.max(50)
});

/** Deletes some of your own logs: Undo for a save, and a visit's Delete. Answers with the rows
 *  it removed, so the caller can put them back. */
export const DELETE: RequestHandler = async ({ locals, request }) => {
	const user = await requireUser(locals);
	const parsed = idsSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Expected a list of log ids');
	return json({ rows: await deleteLogs(user.id, parsed.data.ids) });
};

/** Puts back rows a DELETE removed: Undo for a delete. */
export const PUT: RequestHandler = async ({ locals, request }) => {
	const user = await requireUser(locals);
	const parsed = rowsSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Expected the rows that were deleted');
	await restoreLogs(user.id, parsed.data.rows);
	return json({ restored: parsed.data.rows.length });
};
