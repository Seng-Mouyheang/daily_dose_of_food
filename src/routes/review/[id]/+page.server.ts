import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { ReviewComment } from '#lib/review/card.ts';
import { commentSchema } from '#lib/review/schema.ts';
import { getOrSyncUser } from '#lib/server/auth.ts';
import {
	addComment,
	deleteComment,
	editComment,
	setCommentLiked,
	setCommentPinned
} from '#lib/server/engagement.ts';
import {
	assembleReview,
	canViewReview,
	getComments,
	getReviewChildren,
	getReviewSpine,
	requireVisibleReview
} from '#lib/server/feed.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	// reviews.id is a uuid column — a non-UUID path segment (e.g. /review/abc) would otherwise
	// reach Postgres as-is and raise "invalid input syntax for type uuid", a 500 instead of the
	// 404 a made-up/garbled id should get.
	if (!z.uuid().safeParse(params.id).success) error(404, 'Review not found');

	// Deliberately two steps: the spine carries the gate columns and nothing else, so a review
	// this viewer may not see costs one query and never touches its photos, items or ratings.
	// Independent lookups, so one round trip instead of two.
	const [row, viewer] = await Promise.all([getReviewSpine(params.id), getOrSyncUser(locals)]);
	if (!row) error(404, 'Review not found');

	// A 404 for everyone who may not see it, same as "doesn't exist" — see canViewReview.
	if (!canViewReview(row, viewer?.id ?? null)) error(404, 'Review not found');

	const [children, comments] = await Promise.all([
		getReviewChildren([params.id], viewer?.id ?? null),
		getComments(params.id, viewer?.id ?? null)
	]);

	return {
		review: assembleReview(row, children),
		isOwnReview: viewer?.id === row.userId,
		comments,
		canInteract: viewer !== null
	};
};

/** The submitted `commentId` if it is a uuid, else null — a garbled id would otherwise reach
 *  Postgres and raise a 500. */
function commentIdOf(data: FormData): string | null {
	const id = data.get('commentId');
	return typeof id === 'string' && z.uuid().safeParse(id).success ? id : null;
}

export const actions = {
	comment: async ({ request, params, locals }) => {
		const { user } = await requireVisibleReview(locals, params.id);

		const data = await request.formData();
		const raw = data.get('body');
		const photo = data.get('mediaPublicId');
		const parsed = commentSchema.safeParse({
			body: typeof raw === 'string' ? raw : '',
			mediaPublicId: typeof photo === 'string' && photo ? photo : undefined
		});
		if (!parsed.success) {
			// The typed text is handed back so a rejected comment isn't lost along with the error.
			return fail(400, {
				message: parsed.error.issues[0]?.message ?? 'Check your comment and try again.',
				body: typeof raw === 'string' ? raw : ''
			});
		}

		// Handed back whole so the page can swap it in for its optimistic copy without reloading.
		const replyTo = data.get('parentId');
		const row = await addComment(
			params.id,
			user.id,
			parsed.data.body,
			typeof replyTo === 'string' && z.uuid().safeParse(replyTo).success ? replyTo : null,
			parsed.data.mediaPublicId ?? null
		);
		if (!row) {
			return fail(404, {
				message: "Couldn't post that — the comment or photo is no longer there.",
				body: parsed.data.body
			});
		}
		const comment: ReviewComment = {
			id: row.id,
			body: parsed.data.body,
			createdAt: row.createdAt.toISOString(),
			author: { displayName: user.displayName, avatarUrl: user.avatarUrl },
			parentId: row.parentId,
			pinned: false,
			photo: row.photo,
			isOwn: true,
			editedAt: null,
			likeCount: 0,
			viewerHasLiked: false
		};
		return { comment };
	},

	editComment: async ({ request, params, locals }) => {
		const { user } = await requireVisibleReview(locals, params.id);
		const data = await request.formData();
		const commentId = commentIdOf(data);
		const raw = data.get('body');
		if (!commentId) return fail(400, { message: 'That comment could not be found.' });
		const parsed = commentSchema.safeParse({ body: typeof raw === 'string' ? raw : '' });
		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'Check your comment.' });
		}
		const editedAt = await editComment(commentId, params.id, user.id, parsed.data.body);
		if (!editedAt) return fail(404, { message: 'That comment could not be found.' });
		return { edited: { id: commentId, body: parsed.data.body, editedAt: editedAt.toISOString() } };
	},

	pinComment: async ({ request, params, locals }) => {
		const { user, row } = await requireVisibleReview(locals, params.id);
		// Only the review's author curates its comments.
		if (row.userId !== user.id) return fail(403, { message: 'Only the review author can pin.' });
		const data = await request.formData();
		const commentId = commentIdOf(data);
		if (!commentId) return fail(400, { message: 'That comment could not be found.' });
		if (!(await setCommentPinned(commentId, params.id, data.get('pinned') === 'true'))) {
			return fail(404, { message: 'That comment could not be found.' });
		}
		return { pinned: true };
	},

	likeComment: async ({ request, params, locals }) => {
		const { user } = await requireVisibleReview(locals, params.id);
		const data = await request.formData();
		const commentId = commentIdOf(data);
		if (!commentId) return fail(400, { message: 'That comment could not be found.' });
		const liked = data.get('liked') === 'true';
		const result = await setCommentLiked(commentId, params.id, user.id, liked);
		if (!result.found) return fail(404, { message: 'That comment could not be found.' });
		return { commentLike: { id: commentId, liked, likeCount: result.likeCount } };
	},

	deleteComment: async ({ request, params, locals }) => {
		const { user } = await requireVisibleReview(locals, params.id);

		const commentId = commentIdOf(await request.formData());
		if (!commentId) return fail(400, { message: 'That comment could not be found.' });

		// Not the author, already deleted and never existed all look the same on purpose.
		if (!(await deleteComment(commentId, params.id, user.id))) {
			return fail(404, { message: 'That comment could not be found.' });
		}
		return { deleted: true };
	}
} satisfies Actions;
