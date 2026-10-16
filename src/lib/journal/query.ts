/**
 * The journal's URL state: which tab, the search text, sort, filter, the archived view, the
 * keyset cursor and (desktop) the selected row. Parsed on the server to run the query and
 * rebuilt on the client for every link and chip, so the two can never disagree about what a
 * param means. Pure, so it is unit-tested without a request.
 */
import { z } from 'zod';

export type JournalTab = 'reviews' | 'bookmarks';
export type JournalSort = 'newest' | 'oldest' | 'top' | 'lowest' | 'price_desc' | 'price_asc';

export const JOURNAL_SORTS: { value: JournalSort; label: string; short?: string }[] = [
	{ value: 'newest', label: 'Newest' },
	{ value: 'oldest', label: 'Oldest' },
	{ value: 'top', label: 'Highest rated' },
	{ value: 'lowest', label: 'Lowest rated' },
	{ value: 'price_desc', label: 'Price: high to low', short: 'Price: high' },
	{ value: 'price_asc', label: 'Price: low to high', short: 'Price: low' }
];
export type JournalFilter = 'all' | 'favorites' | 'dishes' | 'drinks';

export const JOURNAL_FILTERS: { value: JournalFilter; label: string }[] = [
	{ value: 'all', label: 'All' },
	{ value: 'favorites', label: 'Favorites' },
	{ value: 'dishes', label: 'Dishes' },
	{ value: 'drinks', label: 'Drinks' }
];

/** Keyset position: the sort date and id, plus the rating or price when sorted by one. */
export interface JournalCursor {
	t: string;
	id: string;
	v?: number;
}

export interface JournalQuery {
	tab: JournalTab;
	q: string;
	sort: JournalSort;
	filter: JournalFilter;
	/** My reviews only; always false on Bookmarks. */
	archived: boolean;
	cursor: JournalCursor | null;
	/** The desktop preview pane's review id. */
	selected: string | null;
}

const MAX_QUERY_LENGTH = 100;

const cursorSchema = z.object({
	t: z.iso.datetime(),
	id: z.uuid(),
	v: z.number().min(0).max(1_000_000).optional()
});

function toBase64Url(s: string): string {
	return btoa(String.fromCharCode(...new TextEncoder().encode(s)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
	const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
	return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
}

export function encodeJournalCursor(cursor: JournalCursor): string {
	return toBase64Url(JSON.stringify(cursor));
}

/** Null for anything malformed: a hand-edited `?cursor=` shows page one, never a 500. */
export function decodeJournalCursor(raw: string | null): JournalCursor | null {
	if (!raw) return null;
	try {
		const parsed = cursorSchema.safeParse(JSON.parse(fromBase64Url(raw)));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

/** Every param falls back to its default rather than failing, for the same reason. */
export function parseJournalQuery(params: URLSearchParams): JournalQuery {
	const tab: JournalTab = params.get('tab') === 'bookmarks' ? 'bookmarks' : 'reviews';
	const rawSort = params.get('sort');
	const sort: JournalSort = JOURNAL_SORTS.some((o) => o.value === rawSort)
		? (rawSort as JournalSort)
		: 'newest';
	const rawFilter = params.get('filter');
	const filter: JournalFilter = JOURNAL_FILTERS.some((f) => f.value === rawFilter)
		? (rawFilter as JournalFilter)
		: 'all';
	const selected = params.get('selected');
	return {
		tab,
		q: (params.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH),
		sort,
		filter,
		archived: tab === 'reviews' && params.get('archived') === '1',
		cursor: decodeJournalCursor(params.get('cursor')),
		selected: selected && z.uuid().safeParse(selected).success ? selected : null
	};
}

/**
 * A `/journal?…` href for `query` with `changes` applied. Defaults are left out so the plain
 * tab URL stays `/journal` / `/journal?tab=bookmarks`. Any change other than the cursor itself
 * resets the cursor (a new filter starts from page one), and switching tab also drops the
 * search, filter, archived view and selection, which belong to the tab they were set on.
 */
export function journalHref(
	query: JournalQuery,
	changes: Partial<Omit<JournalQuery, 'cursor'>> & { cursor?: string | null } = {}
): string {
	const next = { ...query, ...changes };
	if (changes.tab !== undefined && changes.tab !== query.tab) {
		next.q = changes.q ?? '';
		next.filter = changes.filter ?? 'all';
		next.archived = false;
		next.selected = null;
	}
	if (next.tab === 'bookmarks') next.archived = false;

	const params = new URLSearchParams();
	if (next.tab !== 'reviews') params.set('tab', next.tab);
	if (next.archived) params.set('archived', '1');
	if (next.q) params.set('q', next.q);
	if (next.sort !== 'newest') params.set('sort', next.sort);
	if (next.filter !== 'all') params.set('filter', next.filter);
	if (typeof changes.cursor === 'string') params.set('cursor', changes.cursor);
	if (next.selected) params.set('selected', next.selected);

	const qs = params.toString();
	return qs ? `/journal?${qs}` : '/journal';
}
