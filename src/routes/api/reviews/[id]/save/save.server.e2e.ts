import { expect, test } from '@playwright/test';

/** Same contract as the like route: auth is checked first, so a signed-out caller gets 401
 *  whatever the id. The origin header gets past SvelteKit's CSRF check (see like.server.e2e.ts). */
const ID = 'c0ffee00-0000-4000-8000-000000000001';
const headers = { origin: 'http://localhost:4173' };

test('saving while signed out is a 401', async ({ request }) => {
	expect((await request.put(`/api/reviews/${ID}/save`, { headers })).status()).toBe(401);
});

test('removing a save while signed out is a 401', async ({ request }) => {
	expect((await request.delete(`/api/reviews/${ID}/save`, { headers })).status()).toBe(401);
});
