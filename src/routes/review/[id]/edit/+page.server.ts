import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { updateReviewSchema } from '#lib/review/schema.ts';
import { requireUser } from '#lib/server/auth.ts';
import { getReviewFormLookups } from '#lib/server/lookups.ts';
import { getReviewForEdit } from '#lib/server/ownReviews.ts';
import { InvalidPhotoError, ReviewOwnershipError, updateReview } from '#lib/server/reviews.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.auth().userId) redirect(303, '/sign-in');
	const user = await requireUser(locals);
	if (!z.uuid().safeParse(params.id).success) error(404, 'Review not found');

	// Not yours, deleted or nonexistent: all the same 404, as everywhere else.
	const [initial, lookups] = await Promise.all([
		getReviewForEdit(params.id, user.id),
		getReviewFormLookups()
	]);
	if (!initial) error(404, 'Review not found');

	return { initial, lookups };
};

export const actions = {
	/** The edit twin of /review/new's publish action: same payload shape (plus `existing`
	 *  photos), validated the same way, written by updateReview. */
	save: async ({ request, locals, params }) => {
		const user = await requireUser(locals);

		const form = await request.formData();
		let parsedJson: unknown;
		try {
			parsedJson = JSON.parse(String(form.get('payload') ?? 'null'));
		} catch {
			return fail(400, { message: 'Malformed submission.' });
		}

		const parsed = updateReviewSchema.safeParse(parsedJson);
		// The payload carries its own reviewId; it must be the review in the URL.
		if (!parsed.success || parsed.data.reviewId !== params.id) {
			return fail(400, {
				message: 'Something about this review needs fixing before it can be saved.',
				errors: parsed.success ? undefined : z.flattenError(parsed.error)
			});
		}

		const { categories } = await getReviewFormLookups();
		try {
			await updateReview(user.id, parsed.data, categories);
		} catch (err) {
			if (err instanceof ReviewOwnershipError) error(404, 'Review not found');
			if (err instanceof InvalidPhotoError) return fail(400, { message: err.message });
			throw err;
		}

		redirect(303, `/review/${params.id}?saved=1`);
	}
} satisfies Actions;
