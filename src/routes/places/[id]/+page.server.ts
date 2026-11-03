import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { getOrSyncUser } from '#lib/server/auth.ts';
import { getPlacePage } from '#lib/server/feed.ts';
import type { PageServerLoad } from './$types';

/** A place inside Explore: its header card and every public review there. Public like Explore.
 *  A malformed id is a 404 like an unknown one, never a 500. `?q=` is the search it was opened
 *  from, only for the back link. */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!z.uuid().safeParse(params.id).success) error(404, 'Place not found');
	const user = await getOrSyncUser(locals);
	const page = await getPlacePage(params.id, user?.id ?? null);
	if (!page) error(404, 'Place not found');

	return { signedIn: user !== null, query: url.searchParams.get('q')?.trim() ?? '', ...page };
};
