import { and, eq, ilike, isNull, sql } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { places } from '#lib/server/db/schema/index.ts';
import { pointWkt } from '#lib/server/reviews.ts';
import type { RequestHandler } from './$types';

/** `url.searchParams.get` returns `null` for a missing param — `Number(null)` is `0`, a
 *  perfectly finite (and in-range) coordinate, so a naive `Number(...)` + `isFinite` check
 *  can't tell "absent" from "0,0". Returns null for missing/blank/non-numeric/out-of-range
 *  input, so the caller can treat all of those the same: no usable origin. */
function parseCoord(raw: string | null, min: number, max: number): number | null {
	if (!raw) return null;
	const n = Number(raw);
	return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/** Typeahead for the review wizard's place picker. Signed-in only; ordered by distance when
 *  the browser supplies its coordinates, which also doubles as the "320 m away" hint that
 *  discourages creating a duplicate place for somewhere that's already listed. */
export const GET: RequestHandler = async ({ url, locals }) => {
	await requireUser(locals);

	const q = (url.searchParams.get('q') ?? '').trim();
	if (q.length < 2) return json([]);

	const lat = parseCoord(url.searchParams.get('lat'), -90, 90);
	const lng = parseCoord(url.searchParams.get('lng'), -180, 180);
	const hasOrigin = lat !== null && lng !== null;
	const origin = hasOrigin ? sql`ST_GeogFromText(${pointWkt(lat, lng)})` : null;

	const rows = await db
		.select({
			id: places.id,
			name: places.name,
			addressLine1: places.addressLine1,
			city: places.city,
			distanceMeters: origin
				? sql<number>`ST_Distance(${places.location}, ${origin})`
				: sql<null>`NULL`
		})
		.from(places)
		.where(
			and(isNull(places.deletedAt), eq(places.placeStatus, 'active'), ilike(places.name, `%${q}%`))
		)
		.orderBy(origin ? sql`${places.location} <-> ${origin}` : places.name)
		.limit(10);

	return json(rows);
};
