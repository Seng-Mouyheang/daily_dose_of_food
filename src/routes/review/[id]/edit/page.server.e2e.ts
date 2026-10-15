import { expect, test } from '@playwright/test';

test('editing a review sends a signed-out visitor to sign in', async ({ request }) => {
	const res = await request.get('/review/c0ffee00-0000-4000-8000-000000000001/edit', {
		maxRedirects: 0
	});
	expect(res.status()).toBe(303);
	expect(res.headers()['location']).toBe('/sign-in');
});
