import { expect, test } from '@playwright/test';

/** The author-only review routes check auth first, so a signed-out caller gets 401 whatever the
 *  id. The origin header gets past SvelteKit's CSRF check (see like.server.e2e.ts). */
const ID = 'c0ffee00-0000-4000-8000-000000000001';
const headers = { origin: 'http://localhost:4173' };

test('archiving while signed out is a 401', async ({ request }) => {
	expect((await request.put(`/api/reviews/${ID}/archive`, { headers })).status()).toBe(401);
});

test('unarchiving while signed out is a 401', async ({ request }) => {
	expect((await request.delete(`/api/reviews/${ID}/archive`, { headers })).status()).toBe(401);
});

test('deleting while signed out is a 401', async ({ request }) => {
	expect((await request.delete(`/api/reviews/${ID}`, { headers })).status()).toBe(401);
});

test('restoring while signed out is a 401', async ({ request }) => {
	expect((await request.post(`/api/reviews/${ID}/restore`, { headers })).status()).toBe(401);
});
