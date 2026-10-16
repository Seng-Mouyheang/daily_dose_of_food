import { expect, test } from '@playwright/test';

test('the journal sends a signed-out visitor to sign in', async ({ request }) => {
	const res = await request.get('/journal?tab=bookmarks', { maxRedirects: 0 });
	expect(res.status()).toBe(303);
	expect(res.headers()['location']).toBe('/sign-in');
});
