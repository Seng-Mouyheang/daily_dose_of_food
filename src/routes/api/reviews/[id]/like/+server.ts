import { json } from '@sveltejs/kit';
import { countLikes, likeReview, unlikeReview } from '#lib/server/engagement.ts';
import { requireVisibleReview } from '#lib/server/feed.ts';
import type { RequestHandler } from './$types';

/** Shared by PUT and DELETE: both need a signed-in viewer and a review they may see, and both
 *  answer with the settled state so the client's optimistic update can snap to the truth. A
 *  review the viewer can't see is a 404 — never a 403 — for the same reason the review page does
 *  it: a guessed id must not reveal that something private exists. */
async function setLiked(
	{ params, locals }: Parameters<RequestHandler>[0],
	liked: boolean
): Promise<Response> {
	const { user } = await requireVisibleReview(locals, params.id);

	if (liked) await likeReview(params.id, user.id);
	else await unlikeReview(params.id, user.id);

	return json({ liked, likeCount: await countLikes(params.id) });
}

export const PUT: RequestHandler = (event) => setLiked(event, true);
export const DELETE: RequestHandler = (event) => setLiked(event, false);
