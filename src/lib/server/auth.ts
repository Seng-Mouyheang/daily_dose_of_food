import { error } from '@sveltejs/kit';
import { clerkClient } from 'svelte-clerk/server';
import { eq } from 'drizzle-orm';
import { db } from './db/index.ts';
import { users } from './db/schema/index.ts';
import { fromApiUser, upsertUserFromClerk } from './users.ts';

/**
 * Returns the signed-in user's `users` row, creating it on the spot if the Clerk webhook
 * hasn't arrived yet (e.g. right after sign-up). Returns `null` when signed out.
 */
export async function getOrSyncUser(locals: App.Locals) {
	const { userId } = locals.auth();
	if (!userId) return null;

	const [existing] = await db.select().from(users).where(eq(users.clerkUserId, userId)).limit(1);
	if (existing) return existing;

	const clerkUser = await clerkClient.users.getUser(userId);
	return upsertUserFromClerk(fromApiUser(clerkUser));
}

/** Like {@link getOrSyncUser}, but throws a 401 when signed out. */
export async function requireUser(locals: App.Locals) {
	const user = await getOrSyncUser(locals);
	if (!user) error(401, 'Sign in required');
	return user;
}
