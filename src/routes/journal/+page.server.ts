import { redirect } from '@sveltejs/kit';
import { encodeJournalCursor, parseJournalQuery } from '#lib/journal/query.ts';
import { getOrSyncUser } from '#lib/server/auth.ts';
import { getBookmarks, getJournalCounts, getMyReviews } from '#lib/server/journal.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	// Same as /review/new: the journal is reachable from the nav, so a signed-out visitor is
	// sent to sign in rather than shown an error page.
	const user = await getOrSyncUser(locals);
	if (!user) redirect(303, '/sign-in');

	// Lets an archive/unsave from the page refresh just this load, not the whole layout.
	depends('app:journal');

	const query = parseJournalQuery(url.searchParams);
	const [page, counts] = await Promise.all([
		query.tab === 'bookmarks' ? getBookmarks(user.id, query) : getMyReviews(user.id, query),
		getJournalCounts(user.id)
	]);

	return {
		query,
		items: page.items,
		nextCursor: page.nextCursor === null ? null : encodeJournalCursor(page.nextCursor),
		counts
	};
};
