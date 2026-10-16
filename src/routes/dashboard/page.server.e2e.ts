import { expect, test } from '@playwright/test';

test('the dashboard sends a signed-out visitor to sign in', async ({ request }) => {
	const res = await request.get('/dashboard?per=week', { maxRedirects: 0 });
	expect(res.status()).toBe(303);
	expect(res.headers()['location']).toBe('/sign-in');
});
