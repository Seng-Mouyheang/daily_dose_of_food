import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.ts';

export const mediaFiles = pgTable(
	'media_files',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		ownerUserId: uuid('owner_user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		storageProvider: varchar('storage_provider', { length: 30 }).notNull().default('cloudinary'),
		/** Cloudinary public_id */
		storageKey: text('storage_key').notNull().unique(),
		url: text('url').notNull(),
		originalFilename: varchar('original_filename', { length: 255 }),
		format: varchar('format', { length: 20 }),
		width: integer('width'),
		height: integer('height'),
		bytes: integer('bytes'),
		mediaStatus: varchar('media_status', { length: 20 }).notNull().default('pending'),
		moderationStatus: varchar('moderation_status', { length: 20 }).notNull().default('pending'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		deletedAt: timestamp('deleted_at', { withTimezone: true })
	},
	(t) => [
		check('chk_media_status', sql`${t.mediaStatus} IN ('pending', 'active', 'failed', 'deleted')`),
		check(
			'chk_media_moderation',
			sql`${t.moderationStatus} IN ('pending', 'approved', 'rejected', 'flagged')`
		)
	]
);
