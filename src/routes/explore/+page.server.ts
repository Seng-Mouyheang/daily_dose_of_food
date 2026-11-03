import { parseFilters } from '#lib/explore/explore.ts';
import { normalizeQuery, parseSearchTab, searchActive } from '#lib/explore/search.ts';
import { getOrSyncUser } from '#lib/server/auth.ts';
import { countFood, foodMatches, searchPeople, searchPlaces } from '#lib/server/explore-search.ts';
import { getExploreFeed } from '#lib/server/feed.ts';
import type { PageServerLoad } from './$types';

/** Open to signed-out visitors: Explore is the public front window, so it shows the same grid to
 *  everyone and only the like and bookmark controls (and "People I follow") depend on who is
 *  looking.
 *
 *  With a search of 2+ characters the grid becomes the Food results (still filtered and paged),
 *  and people and places come along for the other tabs. All four queries run at once. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const user = await getOrSyncUser(locals);
	const viewerId = user?.id ?? null;
	const filters = parseFilters(url.searchParams);
	const cursor = url.searchParams.get('cursor');
	const raw = url.searchParams.get('q') ?? '';

	if (!searchActive(raw)) {
		const feed = await getExploreFeed({ filters, cursor, viewerId });
		return { signedIn: user !== null, filters, ...feed, search: null };
	}

	const q = normalizeQuery(raw);
	const [feed, people, places, foodCount] = await Promise.all([
		getExploreFeed({ filters, cursor, viewerId, search: foodMatches(q) }),
		searchPeople(q, viewerId),
		searchPlaces(q),
		countFood(q)
	]);

	return {
		signedIn: user !== null,
		filters,
		...feed,
		search: {
			q: raw.trim(),
			tab: parseSearchTab(url.searchParams.get('tab')),
			people,
			places,
			foodCount
		}
	};
};
