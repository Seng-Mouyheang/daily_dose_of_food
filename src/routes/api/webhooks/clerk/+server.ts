import { error } from '@sveltejs/kit';
import { verifyWebhook } from '@clerk/backend/webhooks';
import type { UserWebhookEvent, WebhookEvent } from '@clerk/backend';
import { CLERK_WEBHOOK_SIGNING_SECRET } from '$app/env/private';
import { ClerkUserMissingEmailError, handleUserWebhookEvent } from '#lib/server/users.ts';
import type { RequestHandler } from './$types';

function isUserEvent(event: WebhookEvent): event is UserWebhookEvent {
	return (
		event.type === 'user.created' || event.type === 'user.updated' || event.type === 'user.deleted'
	);
}

export const POST: RequestHandler = async ({ request }) => {
	const event = await verifyWebhook(request, {
		signingSecret: CLERK_WEBHOOK_SIGNING_SECRET
	}).catch((err) => {
		console.error('[clerk webhook] signature verification failed', err);
		return null;
	});

	if (!event) error(400, 'Invalid webhook signature');

	if (!isUserEvent(event)) return Response.json({ ignored: event.type });

	try {
		await handleUserWebhookEvent(event.type, event.data);
	} catch (err) {
		if (err instanceof ClerkUserMissingEmailError) {
			console.warn(`[clerk webhook] skipping ${event.type}: ${err.message}`);
			return Response.json({ skipped: 'missing-email' });
		}
		console.error(`[clerk webhook] failed to handle ${event.type}`, err);
		error(500, 'Failed to sync user');
	}

	return Response.json({ ok: true });
};
