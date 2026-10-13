import { expect, test } from '@playwright/test';

/** A write needs a session, and the check runs before anything else — so a signed-out caller
 *  gets 401 whatever the id, and can't probe which reviews exist by watching 404 vs 401.
 *
 *  The same-origin header matters: without it SvelteKit's CSRF check answers 403 before the
 *  handler runs, which would make these pass or fail for a reason that has nothing to do with
 *  auth. */
const ID = 'c0ffee00-0000-4000-8000-000000000001';
const headers = { origin: 'http://localhost:4173' };

test('liking while signed out is a 401', async ({ request }) => {
	expect((await request.put(`/api/reviews/${ID}/like`, { headers })).status()).toBe(401);
});

test('removing a like while signed out is a 401', async ({ request }) => {
	expect((await request.delete(`/api/reviews/${ID}/like`, { headers })).status()).toBe(401);
});

test('a signed-out comment is a 401', async ({ request }) => {
	const res = await request.post(`/review/${ID}?/comment`, { form: { body: 'hello' }, headers });
	expect(res.status()).toBe(401);
});
