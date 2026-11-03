import { expect, test } from '@playwright/test';

/** Signed out, like Explore's suite; skips without a database, and the round trip skips itself
 *  when the database has no reviewed place to open. */
test.beforeEach(() => {
	test.skip(process.env.E2E_DATABASE_AVAILABLE !== 'true', 'needs a reachable test database');
});

test('a malformed or unknown place id is a 404', async ({ page }) => {
	for (const id of ['nope', 'c0ffee00-0000-4000-8000-000000000001']) {
		const response = await page.goto(`/places/${id}`);
		expect(response?.status(), id).toBe(404);
	}
});

test('a place opened from search links back to the same results', async ({ page }) => {
	// Search for the first few letters of a place that's on the grid, so there is one to open.
	await page.goto('/explore');
	const card = page.locator('article').first();
	test.skip((await card.count()) === 0, 'no public reviews in this database');
	const meta = (await card.getByText(/·/).first().textContent()) ?? '';
	const query = meta.trim().slice(0, 3);
	test.skip(query.length < 2, 'no place name on the first card');

	await page.goto(`/explore?q=${encodeURIComponent(query)}&tab=places`);
	const place = page.getByRole('link', { name: /^Show reviews at / }).first();
	test.skip((await place.count()) === 0, 'no place matches');
	await place.click();

	await expect(page).toHaveURL(new RegExp(`/places/[0-9a-f-]+\\?q=${encodeURIComponent(query)}$`));
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Directions' })).toHaveAttribute(
		'href',
		/^https:\/\/www\.google\.com\/maps\/search\//
	);

	await page.getByRole('link', { name: `Back to results for “${query}”` }).click();
	await expect(page).toHaveURL(`/explore?q=${encodeURIComponent(query)}`);
});
