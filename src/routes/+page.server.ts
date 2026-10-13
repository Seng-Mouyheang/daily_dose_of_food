import { getOrSyncUser } from '#lib/server/auth.ts';
import { decodeCursor, encodeCursor, getForYouFeed, getMonthlyStats } from '#lib/server/feed.ts';
import type { PageServerLoad } from './$types';

export type FeedTab = 'for-you' | 'following';

/** Start and end of the calendar month `now` falls in, in the server's timezone. The sidebar
 *  panel is a rough "how has this month gone" summary, so being a few hours off at a month
 *  boundary for a user in another timezone is not worth a per-user timezone round trip. */
function monthBounds(now: Date): { start: Date; end: Date; label: string } {
	const start = new Date(now.getFullYear(), now.getMonth(), 1);
	const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, -1);
	return { start, end, label: start.toLocaleDateString('en-GB', { month: 'long' }) };
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = await getOrSyncUser(locals);

	// Signed out, this is still the marketing front door — there is no personal feed to build,
	// so it doesn't pay for one.
	if (!user) {
		return {
			user: null,
			tab: 'for-you' as FeedTab,
			reviews: null,
			nextCursor: null,
			stats: null,
			month: null
		};
	}

	const tab: FeedTab = url.searchParams.get('tab') === 'following' ? 'following' : 'for-you';
	const month = monthBounds(new Date());

	// "Following" has no query behind it on purpose: there is no follows table yet, so there is
	// no set of people to filter by. Returning an empty page lets the tab render its own
	// explanation instead of quietly showing the public feed under a label that would be a lie.
	if (tab === 'following') {
		return {
			user,
			tab,
			reviews: [],
			nextCursor: null,
			stats: await getMonthlyStats(user.id, month.start, month.end),
			month: month.label
		};
	}

	const [feed, stats] = await Promise.all([
		getForYouFeed({ cursor: decodeCursor(url.searchParams.get('cursor')), viewerId: user.id }),
		getMonthlyStats(user.id, month.start, month.end)
	]);

	// Handed over already encoded, so the page builds `?cursor=` from one value instead of
	// re-implementing the encoding on the client side of the server/client import guard.
	return {
		user,
		tab,
		reviews: feed.reviews,
		nextCursor: feed.nextCursor === null ? null : encodeCursor(feed.nextCursor),
		stats,
		month: month.label
	};
};
