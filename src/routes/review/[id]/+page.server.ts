import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { getOrSyncUser } from '#lib/server/auth.ts';
import { assembleReview, getReviewChildren, getReviewSpine } from '#lib/server/feed.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	// reviews.id is a uuid column — a non-UUID path segment (e.g. /review/abc) would otherwise
	// reach Postgres as-is and raise "invalid input syntax for type uuid", a 500 instead of the
	// 404 a made-up/garbled id should get.
	if (!z.uuid().safeParse(params.id).success) error(404, 'Review not found');

	// Deliberately two steps: the spine carries the gate columns and nothing else, so a review
	// this viewer may not see costs one query and never touches its photos, items or ratings.
	const row = await getReviewSpine(params.id);
	if (!row) error(404, 'Review not found');

	const viewer = await getOrSyncUser(locals);

	// Not published (still a draft, hidden/removed by moderation, or soft-deleted) or not
	// visible to the public (friends/private) is a 404 for everyone except its own author —
	// same response as "doesn't exist" so a guess can't distinguish "private" from "no such
	// review". Once follow relationships exist, a 'friends'-visibility review should also pass
	// for a viewer who follows the author — not implemented yet, so 'friends' currently behaves
	// like 'private'.
	const isPublic =
		row.visibility === 'public' && row.reviewStatus === 'published' && row.deletedAt === null;
	const isOwnReview = viewer?.id === row.userId;
	if (!isPublic && !isOwnReview) error(404, 'Review not found');

	const children = await getReviewChildren([params.id]);

	return { review: assembleReview(row, children), isOwnReview };
};
