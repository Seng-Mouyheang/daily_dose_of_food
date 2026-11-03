import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireUser } from '#lib/server/auth.ts';
import { followUser, unfollowUser, userExists } from '#lib/server/engagement.ts';
import type { RequestHandler } from './$types';

/** Shared by PUT and DELETE, like the review like route: auth first (a signed-out caller gets 401
 *  whatever the id), then a 404 for anyone who isn't a live account, and the settled state back so
 *  the client's optimistic toggle can snap to it. Following yourself is a 400 — the button never
 *  offers it, so only a hand-made request gets here. */
async function setFollowing(
	{ params, locals }: Parameters<RequestHandler>[0],
	following: boolean
): Promise<Response> {
	const user = await requireUser(locals);
	if (!z.uuid().safeParse(params.id).success || !(await userExists(params.id))) {
		error(404, 'User not found');
	}
	if (params.id === user.id) error(400, "You can't follow yourself");

	if (following) await followUser(user.id, params.id);
	else await unfollowUser(user.id, params.id);

	return json({ following });
}

export const PUT: RequestHandler = (event) => setFollowing(event, true);
export const DELETE: RequestHandler = (event) => setFollowing(event, false);
