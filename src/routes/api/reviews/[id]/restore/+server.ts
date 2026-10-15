import { error, json } from '@sveltejs/kit';
import { requireOwnReviewRequest, restoreDeletedReview } from '#lib/server/ownReviews.ts';
import type { RequestHandler } from './$types';

/** The journal's Undo after a delete. Author only, and only for a review that is deleted. */
export const POST: RequestHandler = async ({ params, locals }) => {
	const user = await requireOwnReviewRequest(locals, params.id);
	if (!(await restoreDeletedReview(params.id, user.id))) error(404, 'Review not found');
	return json({ deleted: false });
};
