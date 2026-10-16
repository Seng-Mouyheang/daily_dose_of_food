import { error, json } from '@sveltejs/kit';
import { requireOwnReviewRequest, softDeleteReview } from '#lib/server/ownReviews.ts';
import type { RequestHandler } from './$types';

/** Deletes the author's own review (a soft delete; POST ./restore undoes it). */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = await requireOwnReviewRequest(locals, params.id);
	if (!(await softDeleteReview(params.id, user.id))) error(404, 'Review not found');
	return json({ deleted: true });
};
