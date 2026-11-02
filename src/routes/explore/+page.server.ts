import { parseExploreFilter } from '#lib/explore/explore.ts';
import { getOrSyncUser } from '#lib/server/auth.ts';
import { decodeCursor, encodeCursor, getForYouFeed } from '#lib/server/feed.ts';
import type { PageServerLoad } from './$types';

/** Open to signed-out visitors: Explore is the public front window, so it shows the same grid to
 *  everyone and only the like and bookmark controls depend on who is looking. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const user = await getOrSyncUser(locals);
	const filter = parseExploreFilter(url.searchParams.get('filter'));

	const feed = await getForYouFeed({
		filter,
		cursor: decodeCursor(url.searchParams.get('cursor')),
		viewerId: user?.id ?? null
	});

	return {
		signedIn: user !== null,
		filter,
		reviews: feed.reviews,
		nextCursor: feed.nextCursor === null ? null : encodeCursor(feed.nextCursor)
	};
};
