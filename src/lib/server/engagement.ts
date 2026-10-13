/**
 * The engagement write path: likes, saves and comments. The read side (counts, the viewer's own likes,
 * the comment list) lives in feed.ts next to the queries it has to stay consistent with.
 *
 * Nothing here checks whether the caller may see the review — that is the route's job, via
 * `canViewReview`, because it already has the spine row in hand. These functions only know how to
 * write once that decision has been made.
 */
import { and, count, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm';
import { db } from './db/index.ts';
import {
	mediaFiles,
	reviewCommentLikes,
	reviewComments,
	reviewLikes,
	reviewSaves
} from './db/schema/index.ts';

/** Idempotent: the composite primary key turns a repeated like (double-click, retry, a second
 *  tab) into a no-op instead of an error. */
export async function likeReview(reviewId: string, userId: string): Promise<void> {
	await db.insert(reviewLikes).values({ reviewId, userId }).onConflictDoNothing();
}

export async function unlikeReview(reviewId: string, userId: string): Promise<void> {
	await db
		.delete(reviewLikes)
		.where(and(eq(reviewLikes.reviewId, reviewId), eq(reviewLikes.userId, userId)));
}

/** Idempotent for the same reason as likeReview. */
export async function saveReview(reviewId: string, userId: string): Promise<void> {
	await db.insert(reviewSaves).values({ reviewId, userId }).onConflictDoNothing();
}

export async function unsaveReview(reviewId: string, userId: string): Promise<void> {
	await db
		.delete(reviewSaves)
		.where(and(eq(reviewSaves.reviewId, reviewId), eq(reviewSaves.userId, userId)));
}

export async function countLikes(reviewId: string): Promise<number> {
	const [row] = await db
		.select({ n: count() })
		.from(reviewLikes)
		.where(eq(reviewLikes.reviewId, reviewId));
	return row?.n ?? 0;
}

/** Inserts a comment, or a reply when `replyTo` is given. A reply to a reply is attached to the
 *  same top-level comment (one level of threading). Returns null when `replyTo` isn't a live
 *  comment on this review, so a stale or forged id can't graft a reply elsewhere. */
export async function addComment(
	reviewId: string,
	userId: string,
	body: string,
	replyTo: string | null = null,
	mediaPublicId: string | null = null
) {
	// The photo must be one this user uploaded and registered that nothing uses yet ('pending'):
	// an 'active' file already belongs to a review or another comment, and attaching it here
	// would let deleting this comment release it for cleanup while that other use still shows it.
	// Anything else is treated like a stale reply target.
	let media: { id: string; url: string; width: number | null; height: number | null } | null = null;
	if (mediaPublicId) {
		[media = null] = await db
			.select({
				id: mediaFiles.id,
				url: mediaFiles.url,
				width: mediaFiles.width,
				height: mediaFiles.height
			})
			.from(mediaFiles)
			.where(
				and(
					eq(mediaFiles.storageKey, mediaPublicId),
					eq(mediaFiles.ownerUserId, userId),
					eq(mediaFiles.mediaStatus, 'pending'),
					isNull(mediaFiles.deletedAt)
				)
			)
			.limit(1);
		if (!media) return null;
	}
	const mediaId = media?.id ?? null;
	const photo = media ? { url: media.url, width: media.width, height: media.height } : null;

	let parentId: string | null = null;
	if (replyTo) {
		const [target] = await db
			.select({ id: reviewComments.id, parentId: reviewComments.parentId })
			.from(reviewComments)
			.where(
				and(
					eq(reviewComments.id, replyTo),
					eq(reviewComments.reviewId, reviewId),
					isNull(reviewComments.deletedAt)
				)
			)
			.limit(1);
		if (!target) return null;
		parentId = target.parentId ?? target.id;
	}

	const insert = db
		.insert(reviewComments)
		.values({ reviewId, userId, body, parentId, mediaId })
		.returning({ id: reviewComments.id, createdAt: reviewComments.createdAt });

	if (!mediaId) {
		const [row] = await insert;
		return { ...row, parentId, photo };
	}
	// Claimed in the same batch as the insert, so the cleanup job (which only removes 'pending'
	// files) can't delete a photo a comment is showing. The update only matches a file still
	// 'pending'; if the cleanup job got there first it matches nothing, and the comment is
	// withdrawn rather than left pointing at a destroyed asset.
	const [claimed, [row]] = await db.batch([
		db
			.update(mediaFiles)
			.set({ mediaStatus: 'active' })
			.where(and(eq(mediaFiles.id, mediaId), eq(mediaFiles.mediaStatus, 'pending')))
			.returning({ id: mediaFiles.id }),
		insert
	]);
	if (claimed.length === 0) {
		await db.delete(reviewComments).where(eq(reviewComments.id, row.id));
		return null;
	}
	return { ...row, parentId, photo };
}

/** Author-only, same single-statement scoping as deleteComment. Returns the edit time, or null
 *  when nothing changed (not theirs, deleted, or not on this review). */
export async function editComment(
	commentId: string,
	reviewId: string,
	userId: string,
	body: string
): Promise<Date | null> {
	const editedAt = new Date();
	const rows = await db
		.update(reviewComments)
		.set({ body, editedAt })
		.where(
			and(
				eq(reviewComments.id, commentId),
				eq(reviewComments.reviewId, reviewId),
				eq(reviewComments.userId, userId),
				isNull(reviewComments.deletedAt)
			)
		)
		.returning({ id: reviewComments.id });
	return rows.length > 0 ? editedAt : null;
}

/** Like or unlike a live comment on this review, then return the settled count. False/0 when the
 *  comment isn't there, so a stale id can't leave a like on a deleted comment. */
export async function setCommentLiked(
	commentId: string,
	reviewId: string,
	userId: string,
	liked: boolean
): Promise<{ found: boolean; likeCount: number }> {
	const [comment] = await db
		.select({ id: reviewComments.id })
		.from(reviewComments)
		.where(
			and(
				eq(reviewComments.id, commentId),
				eq(reviewComments.reviewId, reviewId),
				isNull(reviewComments.deletedAt)
			)
		)
		.limit(1);
	if (!comment) return { found: false, likeCount: 0 };

	if (liked) {
		await db.insert(reviewCommentLikes).values({ commentId, userId }).onConflictDoNothing();
	} else {
		await db
			.delete(reviewCommentLikes)
			.where(
				and(eq(reviewCommentLikes.commentId, commentId), eq(reviewCommentLikes.userId, userId))
			);
	}
	const [row] = await db
		.select({ n: count() })
		.from(reviewCommentLikes)
		.where(eq(reviewCommentLikes.commentId, commentId));
	return { found: true, likeCount: row?.n ?? 0 };
}

/** Pin (or unpin) a top-level comment. Replaces any other pin in the same batch, so the review
 *  never has two — the partial unique index would reject that anyway. Returns false when the
 *  comment isn't a live top-level comment on this review. */
export async function setCommentPinned(
	commentId: string,
	reviewId: string,
	pinned: boolean
): Promise<boolean> {
	const target = and(
		eq(reviewComments.id, commentId),
		eq(reviewComments.reviewId, reviewId),
		isNull(reviewComments.parentId),
		isNull(reviewComments.deletedAt)
	);
	// Checked first: the batch below would otherwise clear the current pin even when the new
	// target is stale, a reply or deleted, leaving the review with no pin at all.
	const [live] = await db
		.select({ id: reviewComments.id })
		.from(reviewComments)
		.where(target)
		.limit(1);
	if (!live) return false;
	await db.batch([
		pinned
			? db
					.update(reviewComments)
					.set({ pinnedAt: null })
					.where(and(eq(reviewComments.reviewId, reviewId), isNotNull(reviewComments.pinnedAt)))
			: db.update(reviewComments).set({ pinnedAt: null }).where(target),
		db
			.update(reviewComments)
			.set({ pinnedAt: pinned ? new Date() : null })
			.where(target)
	]);
	return true;
}

/** Soft delete of the author's comment and its thread's replies. Returns false when the comment
 *  doesn't exist, is already gone, or belongs to someone else — and the caller deliberately
 *  doesn't say which. Their photos go back to 'pending' so the cleanup job reclaims them. */
export async function deleteComment(
	commentId: string,
	reviewId: string,
	userId: string
): Promise<boolean> {
	const [own] = await db
		.select({ id: reviewComments.id })
		.from(reviewComments)
		.where(
			and(
				eq(reviewComments.id, commentId),
				eq(reviewComments.reviewId, reviewId),
				eq(reviewComments.userId, userId),
				isNull(reviewComments.deletedAt)
			)
		)
		.limit(1);
	if (!own) return false;

	const thread = and(
		or(eq(reviewComments.id, commentId), eq(reviewComments.parentId, commentId)),
		isNull(reviewComments.deletedAt)
	);
	// One batch (a transaction): photos are released while their rows are still live, then the
	// thread is hidden.
	await db.batch([
		db
			.update(mediaFiles)
			.set({ mediaStatus: 'pending' })
			.where(
				and(
					eq(mediaFiles.mediaStatus, 'active'),
					inArray(
						mediaFiles.id,
						db.select({ id: reviewComments.mediaId }).from(reviewComments).where(thread)
					)
				)
			),
		db.update(reviewComments).set({ deletedAt: new Date() }).where(thread)
	]);
	return true;
}
