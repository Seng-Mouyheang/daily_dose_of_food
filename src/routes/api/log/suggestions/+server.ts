import { json } from '@sveltejs/kit';
import { rankPlaces } from '#lib/log/suggest.ts';
import { requireUser } from '#lib/server/auth.ts';
import { getItemHistory, getPlaceHistory } from '#lib/server/logs.ts';
import type { RequestHandler } from './$types';

/** What the Log a visit form suggests from, fetched once when it opens: the places you go to
 *  (ranked, capped) and your recent items. The form ranks and filters them as you type. */
export const GET: RequestHandler = async ({ locals }) => {
	const user = await requireUser(locals);
	const [items, places] = await Promise.all([getItemHistory(user.id), getPlaceHistory(user.id)]);
	return json({ items, places: rankPlaces(places).slice(0, 200) });
};
