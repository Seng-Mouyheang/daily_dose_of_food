import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getOrSyncUser } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { places, reviews } from '#lib/server/db/schema/index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	// reviews.id is a uuid column — a non-UUID path segment (e.g. /review/abc) would otherwise
	// reach Postgres as-is and raise "invalid input syntax for type uuid", a 500 instead of the
	// 404 a made-up/garbled id should get.
	if (!z.uuid().safeParse(params.id).success) error(404, 'Review not found');

	const [row] = await db
		.select({ review: reviews, placeName: places.name })
		.from(reviews)
		.innerJoin(places, eq(reviews.placeId, places.id))
		.where(eq(reviews.id, params.id))
		.limit(1);

	if (!row) error(404, 'Review not found');

	// Not published (still a draft, hidden/removed by moderation, or soft-deleted) or not
	// visible to the public (friends/private) is a 404 for everyone except its own author —
	// same response as "doesn't exist" so a guess can't distinguish "private" from "no such
	// review". Once follow relationships exist, a 'friends'-visibility review should also pass
	// for a viewer who follows the author — not implemented yet, so 'friends' currently behaves
	// like 'private'.
	const isPublic =
		row.review.visibility === 'public' &&
		row.review.reviewStatus === 'published' &&
		row.review.deletedAt === null;
	if (!isPublic) {
		const viewer = await getOrSyncUser(locals);
		if (viewer?.id !== row.review.userId) error(404, 'Review not found');
	}

	return row;
};
