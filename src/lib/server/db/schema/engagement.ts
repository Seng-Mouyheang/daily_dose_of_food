import { sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
	check,
	index,
	pgTable,
	primaryKey,
	timestamp,
	uniqueIndex,
	uuid,
	varchar
} from 'drizzle-orm/pg-core';
import { mediaFiles } from './media.ts';
import { reviews } from './reviews.ts';
import { users } from './users.ts';

/** One row per (review, user) — the composite key is what makes liking twice impossible, so
 *  the write path can be a plain insert-or-ignore. */
export const reviewLikes = pgTable(
	'review_likes',
	{
		reviewId: uuid('review_id')
			.notNull()
			.references(() => reviews.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		primaryKey({ columns: [t.reviewId, t.userId] }),
		index('idx_review_likes_user').on(t.userId)
	]
);

/** A private bookmark: one row per (review, user), the same shape as a like. Never counted or
 *  shown to anyone but the saver; the user index is what the Saved page lists from. */
export const reviewSaves = pgTable(
	'review_saves',
	{
		reviewId: uuid('review_id')
			.notNull()
			.references(() => reviews.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		primaryKey({ columns: [t.reviewId, t.userId] }),
		index('idx_review_saves_user').on(t.userId, sql`${t.createdAt} DESC`)
	]
);

export const reviewComments = pgTable(
	'review_comments',
	{
		id: uuid('review_comment_id').primaryKey().defaultRandom(),
		reviewId: uuid('review_id')
			.notNull()
			.references(() => reviews.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		/** Set on a reply: always the top-level comment (one level of threading, so a reply to a
		 *  reply attaches to the same thread). Cascades so removing a thread removes its replies. */
		parentId: uuid('parent_comment_id').references((): AnyPgColumn => reviewComments.id, {
			onDelete: 'cascade'
		}),
		body: varchar('body', { length: 1000 }).notNull(),
		/** An optional attached photo (one per comment). */
		mediaId: uuid('media_id').references(() => mediaFiles.id, { onDelete: 'restrict' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		/** Set while the review's author has this top-level comment pinned. */
		pinnedAt: timestamp('pinned_at', { withTimezone: true }),
		/** Set when the author edits the body; drives the "Edited" marker. */
		editedAt: timestamp('edited_at', { withTimezone: true }),
		deletedAt: timestamp('deleted_at', { withTimezone: true })
	},
	(t) => [
		index('idx_review_comments_review')
			.on(t.reviewId, sql`${t.createdAt} DESC`)
			.where(sql`${t.deletedAt} IS NULL`),
		index('idx_review_comments_parent').on(t.parentId),
		// At most one live pinned comment per review, enforced by the database.
		uniqueIndex('uq_review_comments_pinned')
			.on(t.reviewId)
			.where(sql`${t.pinnedAt} IS NOT NULL AND ${t.deletedAt} IS NULL`),
		// Text, a photo, or both — never neither.
		check(
			'chk_review_comment_body',
			sql`char_length(btrim(${t.body})) > 0 OR ${t.mediaId} IS NOT NULL`
		)
	]
);

export const reviewCommentLikes = pgTable(
	'review_comment_likes',
	{
		commentId: uuid('review_comment_id')
			.notNull()
			.references(() => reviewComments.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [primaryKey({ columns: [t.commentId, t.userId] })]
);
