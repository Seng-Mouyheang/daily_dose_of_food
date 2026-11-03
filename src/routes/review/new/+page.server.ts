import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { logsOfVisit, logsToReviewDraft } from '#lib/log/review.ts';
import { requireUser } from '#lib/server/auth.ts';
import { getLogsForReview, linkLogsToReview } from '#lib/server/logs.ts';
import { getReviewFormLookups } from '#lib/server/lookups.ts';
import { InvalidPhotoError, publishReview, ReviewOwnershipError } from '#lib/server/reviews.ts';
import { publishReviewSchema } from '#lib/review/schema.ts';
import type { Actions, PageServerLoad } from './$types';

/** The ids in `?fromLog=a,b` / the form's `fromLog` field: a visit's logs. A visit has no cap
 *  (groupVisits merges every save with the same day, meal, place and dining), so neither do these. */
const logIds = (raw: unknown) =>
	z
		.array(z.uuid())
		.catch([])
		.parse(
			String(raw ?? '')
				.split(',')
				.filter(Boolean)
		);

export const load: PageServerLoad = async ({ locals, url }) => {
	// A plain redirect, not requireUser's 401 — this page is now reachable from the header
	// nav for anyone, so a signed-out visitor should land on sign-in, not an error page.
	// (The publish action below still uses requireUser: a POST with no session is a real
	// failure, not a navigation to redirect.)
	if (!locals.auth().userId) redirect(303, '/sign-in');
	const lookups = await getReviewFormLookups();

	// Coming from the Log (`?fromLog=<ids>`): start the form from that visit. Logs that aren't
	// yours or are already in a live review are ignored, and then it's just a blank form. Logs of
	// an archived or deleted review count as unreviewed (see linkLogsToReview).
	const ids = logIds(url.searchParams.get('fromLog'));
	if (!ids.length) return { lookups, initial: null, fromLog: [] };
	const { logs, place } = await getLogsForReview((await requireUser(locals)).id, ids);
	if (!logs.length) return { lookups, initial: null, fromLog: [] };
	return {
		lookups,
		initial: logsToReviewDraft(logs, place, crypto.randomUUID()),
		fromLog: ids,
		backHref: `/log?day=${logs[0]!.loggedOn}`
	};
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
			// +page.svelte only ever renders `form?.message` — without one here, a rejected
			// payload (an item name past its 200-char schema limit when the input itself has no
			// maxlength, a 11th photo from a race between two concurrent uploads, ...) left the
			// user clicking Publish with zero visible feedback. `errors` stays too, for whenever
			// this gets field-level messages.
			return fail(400, {
				message: 'Something about this review needs fixing before it can publish.',
				errors: z.flattenError(parsed.error)
			});
		}

		const { categories } = await getReviewFormLookups();

		let reviewId: string;
		try {
			reviewId = await publishReview(user.id, parsed.data, categories);
		} catch (err) {
			if (err instanceof InvalidPhotoError || err instanceof ReviewOwnershipError) {
				return fail(400, { message: err.message });
			}
			throw err;
		}

		// Written from a visit in the Log: those logs are now this review, counted once. Only the
		// ones that are this visit (the field is the client's word), and linkLogsToReview keeps
		// to the viewer's own.
		const ids = logIds(form.get('fromLog'));
		if (ids.length) {
			const { logs } = await getLogsForReview(user.id, ids);
			await linkLogsToReview(user.id, logsOfVisit(logs, parsed.data), reviewId);
		}

		redirect(303, `/review/${reviewId}`);
	}
} satisfies Actions;
