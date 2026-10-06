import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { requireUser } from '#lib/server/auth.ts';
import { getReviewFormLookups } from '#lib/server/lookups.ts';
import { InvalidPhotoError, publishReview } from '#lib/server/reviews.ts';
import { publishReviewSchema } from '#lib/review/schema.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// A plain redirect, not requireUser's 401 — this page is now reachable from the header
	// nav for anyone, so a signed-out visitor should land on sign-in, not an error page.
	// (The publish action below still uses requireUser: a POST with no session is a real
	// failure, not a navigation to redirect.)
	if (!locals.auth().userId) redirect(303, '/sign-in');
	return { lookups: await getReviewFormLookups() };
};

export const actions = {
	publish: async ({ request, locals }) => {
		const user = await requireUser(locals);

		const form = await request.formData();
		let parsedJson: unknown;
		try {
			parsedJson = JSON.parse(String(form.get('payload') ?? 'null'));
		} catch {
			return fail(400, { message: 'Malformed submission.' });
		}

		const parsed = publishReviewSchema.safeParse(parsedJson);
		if (!parsed.success) {
			return fail(400, { errors: z.flattenError(parsed.error) });
		}

		const { categories } = await getReviewFormLookups();

		let reviewId: string;
		try {
			reviewId = await publishReview(user.id, parsed.data, categories);
		} catch (err) {
			if (err instanceof InvalidPhotoError) {
				return fail(400, { message: err.message });
			}
			throw err;
		}

		redirect(303, `/review/${reviewId}`);
	}
} satisfies Actions;
