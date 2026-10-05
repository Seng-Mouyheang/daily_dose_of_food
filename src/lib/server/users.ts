import type { User, UserDeletedJSON, UserJSON } from '@clerk/backend';
import { eq, sql } from 'drizzle-orm';
import { slugify } from '../../../scripts/seed-data.ts';
import { db } from './db/index.ts';
import { users } from './db/schema/index.ts';

/** The handful of Clerk user fields we need, normalized to one shape regardless of
 *  whether they came from a webhook payload (snake_case) or the Backend API (camelCase). */
export interface ClerkUserInput {
	id: string;
	username: string | null;
	firstName: string | null;
	lastName: string | null;
	primaryEmail: string | undefined;
	imageUrl: string;
	hasImage: boolean;
}

export function fromWebhookJSON(data: UserJSON): ClerkUserInput {
	const match = data.email_addresses.find((e) => e.id === data.primary_email_address_id);
	return {
		id: data.id,
		username: data.username,
		firstName: data.first_name,
		lastName: data.last_name,
		primaryEmail: (match ?? data.email_addresses[0])?.email_address,
		imageUrl: data.image_url,
		hasImage: data.has_image
	};
}

export function fromApiUser(data: User): ClerkUserInput {
	const match = data.emailAddresses.find((e) => e.id === data.primaryEmailAddressId);
	return {
		id: data.id,
		username: data.username,
		firstName: data.firstName,
		lastName: data.lastName,
		primaryEmail: (match ?? data.emailAddresses[0])?.emailAddress,
		imageUrl: data.imageUrl,
		hasImage: data.hasImage
	};
}

export interface MappedUser {
	clerkUserId: string;
	email: string;
	displayName: string;
	avatarUrl: string | null;
}

/**
 * Thrown when a Clerk user payload has no email address. Our schema requires one, but Clerk's
 * dashboard "send test event" tool sends canned sample payloads that often omit it, so callers
 * that might receive test events (the webhook route) should treat this as a payload to skip,
 * not a server failure — it will never succeed on retry.
 */
export class ClerkUserMissingEmailError extends Error {
	constructor(clerkUserId: string) {
		super(`Clerk user ${clerkUserId} has no email address`);
		this.name = 'ClerkUserMissingEmailError';
	}
}

function requireEmail(data: ClerkUserInput): string {
	if (!data.primaryEmail) throw new ClerkUserMissingEmailError(data.id);
	return data.primaryEmail;
}

function fallbackDisplayName(data: ClerkUserInput, email: string): string {
	const full = [data.firstName, data.lastName].filter(Boolean).join(' ').trim();
	return data.username || full || email.split('@')[0];
}

/** Turns a normalized Clerk user into a `users` row, without touching the database. */
export function mapClerkUser(data: ClerkUserInput): MappedUser {
	const email = requireEmail(data);
	return {
		clerkUserId: data.id,
		email,
		displayName: fallbackDisplayName(data, email),
		avatarUrl: data.hasImage ? data.imageUrl : null
	};
}

/** Base username, then numbered variants (`mimi`, `mimi2`, `mimi3`, ...) to try on conflict. */
export function candidateUsernames(data: ClerkUserInput): string[] {
	const email = requireEmail(data);
	const base = slugify(data.username || fallbackDisplayName(data, email)) || 'user';
	return [base, ...Array.from({ length: 24 }, (_, i) => `${base}${i + 2}`)];
}

/**
 * Creates or updates the `users` row for a Clerk user. Retries with the next candidate
 * username when the active-username unique index rejects one (neon-http has no transactions,
 * so this is a plain retry loop rather than a rolled-back transaction).
 */
export async function upsertUserFromClerk(data: ClerkUserInput) {
	// Clerk ids are permanent and never reused, so an existing row already marked deleted means
	// this create/update is a stale, out-of-order delivery (e.g. the deletion's webhook arrived
	// before a retried/delayed creation) — skip it rather than resurrecting the row. See
	// softDeleteUser for how a deleted row can exist even if we never processed a creation.
	const [existing] = await db.select().from(users).where(eq(users.clerkUserId, data.id)).limit(1);
	if (existing?.deletedAt) return existing;

	const mapped = mapClerkUser(data);
	const candidates = candidateUsernames(data);

	for (const [i, username] of candidates.entries()) {
		try {
			const [row] = await db
				.insert(users)
				.values({ ...mapped, username })
				.onConflictDoUpdate({
					target: users.clerkUserId,
					set: {
						email: mapped.email,
						displayName: mapped.displayName,
						avatarUrl: mapped.avatarUrl
					}
				})
				.returning();
			return row;
		} catch (err) {
			const isUsernameConflict =
				err instanceof Error && err.message.includes('uq_users_username_active');
			if (!isUsernameConflict || i === candidates.length - 1) throw err;
		}
	}
	throw new Error(`Could not find a free username for Clerk user ${data.id}`);
}

/**
 * Soft-deletes the row for a Clerk user, or creates a deleted tombstone row if we never
 * synced one (e.g. the webhook arrived before any create/update did). The tombstone, not a
 * plain no-op update, is what lets upsertUserFromClerk recognize and skip a later, stale
 * create/update for the same id instead of resurrecting it as active.
 */
export async function softDeleteUser(clerkUserId: string) {
	await db
		.insert(users)
		.values({
			clerkUserId,
			username: `deleted-${clerkUserId}`,
			email: `${clerkUserId}@deleted.invalid`,
			displayName: 'Deleted user',
			deletedAt: sql`now()`,
			accountStatus: 'deleted'
		})
		.onConflictDoUpdate({
			target: users.clerkUserId,
			set: { deletedAt: sql`now()`, accountStatus: 'deleted' }
		});
}

export function handleUserWebhookEvent(
	type: 'user.created' | 'user.updated' | 'user.deleted',
	data: UserJSON | UserDeletedJSON
) {
	if (type === 'user.deleted') {
		const { id } = data as UserDeletedJSON;
		if (!id) throw new Error('user.deleted webhook payload is missing an id');
		return softDeleteUser(id);
	}
	return upsertUserFromClerk(fromWebhookJSON(data as UserJSON));
}
