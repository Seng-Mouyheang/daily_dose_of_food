import { expect, test } from '@playwright/test';

/** The load function's guards. Widening that query to pull in photos, items, ratings and tags
 *  is exactly the change that could drop the uuid check or let a non-published review through,
 *  so these two pin the 404s down. */
test('a non-uuid review id is a 404, not a database error', async ({ page }) => {
	const response = await page.goto('/review/not-a-uuid');
	expect(response?.status()).toBe(404);
});

test('an unknown review id is a 404', async ({ page }) => {
	const response = await page.goto('/review/c0ffee00-0000-4000-8000-000000000001');
	expect(response?.status()).toBe(404);
});
