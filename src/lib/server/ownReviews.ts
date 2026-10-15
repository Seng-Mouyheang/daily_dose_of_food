/**
 * What an author can do to their own published review from the journal: archive it, bring it
 * back, delete it, and undo that delete.
 *
 * Each is one UPDATE scoped by `user_id`, so ownership is enforced by the statement itself
 * rather than a read-then-write that could race. A false return means "no row matched": not
 * yours, no such review, or already in the requested state. The routes turn all of those into
 * the same 404, so a guessed id can't tell "someone else's" from "doesn't exist".
 */
import { error } from '@sveltejs/kit';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from './auth.ts';
import { db } from './db/index.ts';
import { reviews } from './db/schema/index.ts';

const ownLive = (reviewId: string, userId: string) =>
	and(
		eq(reviews.id, reviewId),
		eq(reviews.userId, userId),
		eq(reviews.reviewStatus, 'published'),
		isNull(reviews.deletedAt)
	);

/** Archive or restore from the archive. Idempotent: archiving an archived review succeeds. */
export async function setReviewArchived(
	reviewId: string,
	userId: string,
	archived: boolean
): Promise<boolean> {
	const rows = await db
		.update(reviews)
		.set({ archivedAt: archived ? new Date() : null })
		.where(ownLive(reviewId, userId))
		.returning({ id: reviews.id });
	return rows.length > 0;
}

/** Soft delete. The row, its photos and comments stay, so the journal's Undo can bring it all
 *  back with restoreDeletedReview. */
export async function softDeleteReview(reviewId: string, userId: string): Promise<boolean> {
	const rows = await db
		.update(reviews)
		.set({ deletedAt: new Date() })
		.where(ownLive(reviewId, userId))
		.returning({ id: reviews.id });
	return rows.length > 0;
}

export async function restoreDeletedReview(reviewId: string, userId: string): Promise<boolean> {
	const rows = await db
		.update(reviews)
		.set({ deletedAt: null })
		.where(
			and(
				eq(reviews.id, reviewId),
				eq(reviews.userId, userId),
				eq(reviews.reviewStatus, 'published'),
				isNotNull(reviews.deletedAt)
			)
		)
		.returning({ id: reviews.id });
	return rows.length > 0;
}

/** The gate for the author-only routes: 401 signed out, 404 for a non-uuid id. Whether the
 *  review is actually theirs is left to the scoped UPDATE above. */
export async function requireOwnReviewRequest(locals: App.Locals, reviewId: string) {
	const user = await requireUser(locals);
	if (!z.uuid().safeParse(reviewId).success) error(404, 'Review not found');
	return user;
}
