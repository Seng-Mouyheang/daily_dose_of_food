import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { citext } from './types.ts';

export const users = pgTable(
	'users',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		clerkUserId: text('clerk_user_id').notNull().unique(),
		username: citext('username').notNull(),
		email: citext('email').notNull(),
		displayName: varchar('display_name', { length: 100 }).notNull(),
		bio: varchar('bio', { length: 1000 }),
		/** Clerk's hosted profile image. Takes precedence over avatarMediaId when set. */
		avatarUrl: text('avatar_url'),
		// FK to media_files is added in relations only, to avoid a circular table dependency
		avatarMediaId: uuid('avatar_media_id'),
		accountStatus: varchar('account_status', { length: 20 }).notNull().default('active'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		deletedAt: timestamp('deleted_at', { withTimezone: true })
	},
	(t) => [
		uniqueIndex('uq_users_username_active')
			.on(t.username)
			.where(sql`${t.deletedAt} IS NULL`),
		uniqueIndex('uq_users_email_active')
			.on(t.email)
			.where(sql`${t.deletedAt} IS NULL`),
		check(
			'chk_user_account_status',
			sql`${t.accountStatus} IN ('pending', 'active', 'suspended', 'deactivated', 'deleted')`
		)
	]
);
