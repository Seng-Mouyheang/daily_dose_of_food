import { expect, test } from '@playwright/test';

/** Same contract as the like and save routes: auth is checked first, so a signed-out caller gets
 *  401 whatever the id. The origin header gets past SvelteKit's CSRF check (see like.server.e2e.ts). */
const ID = 'c0ffee00-0000-4000-8000-000000000001';
const headers = { origin: 'http://localhost:4173' };

test('following while signed out is a 401', async ({ request }) => {
	expect((await request.put(`/api/users/${ID}/follow`, { headers })).status()).toBe(401);
});

test('removing a follow while signed out is a 401', async ({ request }) => {
	expect((await request.delete(`/api/users/${ID}/follow`, { headers })).status()).toBe(401);
});
