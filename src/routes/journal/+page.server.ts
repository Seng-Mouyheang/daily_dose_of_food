import { redirect } from '@sveltejs/kit';
import { encodeJournalCursor, parseJournalQuery, type JournalQuery } from '#lib/journal/query.ts';
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
	// The other tab's first page too, as a tab switch would show it (same sort, no search,
	// filter or archived view), so the page can switch tabs without waiting on a request.
	const other: JournalQuery = {
		...query,
		tab: query.tab === 'bookmarks' ? 'reviews' : 'bookmarks',
		q: '',
		filter: 'all',
		archived: false,
		cursor: null,
		selected: null
	};
	const fetchTab = (q: JournalQuery) =>
		q.tab === 'bookmarks' ? getBookmarks(user.id, q) : getMyReviews(user.id, q);
	const [page, otherPage, counts] = await Promise.all([
		fetchTab(query),
		fetchTab(other),
		getJournalCounts(user.id)
	]);
	const cursorOf = (p: typeof page) =>
		p.nextCursor === null ? null : encodeJournalCursor(p.nextCursor);

	return {
		query,
		items: page.items,
		nextCursor: cursorOf(page),
		other: { query: other, items: otherPage.items, nextCursor: cursorOf(otherPage) },
		counts
	};
};
