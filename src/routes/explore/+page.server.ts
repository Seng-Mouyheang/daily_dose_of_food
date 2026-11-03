import { parseFilters } from '#lib/explore/explore.ts';
import { getOrSyncUser } from '#lib/server/auth.ts';
import { getExploreFeed } from '#lib/server/feed.ts';
import type { PageServerLoad } from './$types';

/** Open to signed-out visitors: Explore is the public front window, so it shows the same grid to
 *  everyone and only the like and bookmark controls (and "People I follow") depend on who is
 *  looking. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const user = await getOrSyncUser(locals);
	const filters = parseFilters(url.searchParams);

	const feed = await getExploreFeed({
		filters,
		cursor: url.searchParams.get('cursor'),
		viewerId: user?.id ?? null
	});

	return { signedIn: user !== null, filters, ...feed };
};
