import { error, json } from '@sveltejs/kit';
import { requireOwnReviewRequest, setReviewArchived } from '#lib/server/ownReviews.ts';
import type { RequestHandler } from './$types';

/** PUT archives, DELETE restores from the archive. Author only; anyone else gets the same 404
 *  as a review that doesn't exist. Answers with the settled state, like the save route. */
async function setArchived(
	{ params, locals }: Parameters<RequestHandler>[0],
	archived: boolean
): Promise<Response> {
	const user = await requireOwnReviewRequest(locals, params.id);
	if (!(await setReviewArchived(params.id, user.id, archived))) error(404, 'Review not found');
	return json({ archived });
}

export const PUT: RequestHandler = (event) => setArchived(event, true);
export const DELETE: RequestHandler = (event) => setArchived(event, false);
