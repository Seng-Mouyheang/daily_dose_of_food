/**
 * Signs a sample Clerk `user.created` webhook payload and POSTs it to the running dev
 * server, so the webhook route can be tested locally without exposing it through ngrok.
 * Requires the dev server to be running, and CLERK_WEBHOOK_SIGNING_SECRET in .env to match
 * whatever the server process has loaded (the placeholder value works for local testing).
 *
 * Usage: pnpm clerk:webhook-test [event]
 *   event: user.created (default), user.updated, or user.deleted
 */
import { Webhook } from 'standardwebhooks';

const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
if (!secret) throw new Error('CLERK_WEBHOOK_SIGNING_SECRET is not set');

const url = process.env.WEBHOOK_URL ?? 'http://localhost:5173/api/webhooks/clerk';
const eventType = process.argv[2] ?? 'user.created';

const clerkUserId = `user_test_${Date.now()}`;

const userJSON = {
	object: 'user',
	id: clerkUserId,
	username: null,
	first_name: 'Test',
	last_name: 'User',
	image_url: 'https://img.clerk.com/placeholder.png',
	has_image: false,
	primary_email_address_id: 'idn_test',
	primary_phone_number_id: null,
	primary_web3_wallet_id: null,
	password_enabled: true,
	two_factor_enabled: false,
	totp_enabled: false,
	backup_code_enabled: false,
	email_addresses: [
		{
			object: 'email_address',
			id: 'idn_test',
			email_address: `test+${Date.now()}@example.com`,
			verification: null,
			linked_to: []
		}
	],
	phone_numbers: [],
	web3_wallets: [],
	organization_memberships: null,
	external_accounts: [],
	enterprise_accounts: [],
	password_last_updated_at: null,
	public_metadata: {},
	private_metadata: {},
	unsafe_metadata: {},
	external_id: null,
	last_sign_in_at: null,
	banned: false,
	locked: false,
	lockout_expires_in_seconds: null,
	verification_attempts_remaining: null,
	created_at: Date.now(),
	updated_at: Date.now(),
	last_active_at: null,
	create_organization_enabled: true,
	create_organizations_limit: null,
	delete_self_enabled: true,
	legal_accepted_at: null,
	locale: null,
	timezone: null
};

const data =
	eventType === 'user.deleted' ? { object: 'user', id: clerkUserId, deleted: true } : userJSON;

const payload = JSON.stringify({ type: eventType, data, object: 'event' });
const msgId = `msg_${crypto.randomUUID()}`;
const timestamp = new Date();

const wh = new Webhook(secret);
const signature = wh.sign(msgId, timestamp, payload);

// @clerk/backend still reads the legacy Svix header names, not the Standard Webhooks ones
// that the `standardwebhooks` package itself documents.
const res = await fetch(url, {
	method: 'POST',
	headers: {
		'content-type': 'application/json',
		'svix-id': msgId,
		'svix-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
		'svix-signature': signature
	},
	body: payload
});

console.log(`${eventType} -> ${res.status}`);
console.log(await res.text());

if (!res.ok) process.exitCode = 1;
