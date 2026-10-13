import { json } from '@sveltejs/kit';
import { saveReview, unsaveReview } from '#lib/server/engagement.ts';
import { requireVisibleReview } from '#lib/server/feed.ts';
import type { RequestHandler } from './$types';

/** The like route's twin: same gate (401 signed out, 404 for anything the viewer can't see), and
 *  answers with the settled state. No count — a save is private to the person who made it. */
async function setSaved(
	{ params, locals }: Parameters<RequestHandler>[0],
	saved: boolean
): Promise<Response> {
	const { user } = await requireVisibleReview(locals, params.id);

	if (saved) await saveReview(params.id, user.id);
	else await unsaveReview(params.id, user.id);

	return json({ saved });
}

export const PUT: RequestHandler = (event) => setSaved(event, true);
export const DELETE: RequestHandler = (event) => setSaved(event, false);
