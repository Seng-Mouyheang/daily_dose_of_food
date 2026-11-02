import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireUser } from '#lib/server/auth.ts';
import { deleteLogs } from '#lib/server/logs.ts';
import type { RequestHandler } from './$types';

const idsSchema = z.object({ ids: z.array(z.uuid()).min(1).max(50) });

/** Deletes some of your own logs: Undo for a save, and a visit's Delete. Answers with the rows
 *  it removed, so the caller can put them back. */
export const DELETE: RequestHandler = async ({ locals, request }) => {
	const user = await requireUser(locals);
	const parsed = idsSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Expected a list of log ids');
	return json({ rows: await deleteLogs(user.id, parsed.data.ids) });
};
