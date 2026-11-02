import { expect, test, type Page } from '@playwright/test';

/** Signed out, which is all this suite can be (no Clerk auth fixture) and also the case Explore
 *  exists for: it is the public front window. Every load queries the database, so the file
 *  skips without one; CI's test database may be empty, so the card tests skip themselves when
 *  there is nothing to click. */
test.beforeEach(() => {
	test.skip(process.env.E2E_DATABASE_AVAILABLE !== 'true', 'needs a reachable test database');
});

const filters = (page: Page) => page.getByRole('navigation', { name: 'Filter' });

test('signed out, Explore shows the grid with All selected', async ({ page }) => {
	const response = await page.goto('/explore');
	expect(response?.status()).toBe(200);
	await expect(page.getByRole('heading', { level: 1, name: 'Explore' })).toBeVisible();
	await expect(filters(page).locator('[aria-current="true"]')).toHaveText('All');
	await expect(
		page
			.getByRole('link', { name: /^Open review:/ })
			.first()
			.or(page.getByText('No public reviews yet.'))
	).toBeVisible();
});

test('a filter pill puts the filter in the URL and selects itself', async ({ page }) => {
	await page.goto('/explore');
	await filters(page).getByRole('link', { name: 'Desserts' }).click();
	await expect(page).toHaveURL(/\/explore\?filter=desserts$/);
	await expect(filters(page).locator('[aria-current="true"]')).toHaveText('Desserts');
	await expect(
		page
			.getByRole('link', { name: /^Open review:/ })
			.first()
			.or(page.getByText('No reviews match “Desserts” yet.'))
	).toBeVisible();
});

test('a hand-edited filter or cursor falls back to the first page of All', async ({ page }) => {
	for (const query of ['?filter=pizza', '?cursor=garbage', '?cursor=2026-01-01_not-a-uuid']) {
		const response = await page.goto(`/explore${query}`);
		expect(response?.status(), query).toBe(200);
		await expect(filters(page).locator('[aria-current="true"]')).toHaveText('All');
	}
});

test('signed out, like and bookmark send you to sign in', async ({ page }) => {
	await page.goto('/explore');
	const cards = page.locator('article');
	test.skip((await cards.count()) === 0, 'no public reviews in this database');

	const card = cards.first();
	await expect(card.getByRole('link', { name: /^Sign in to like/ })).toHaveAttribute(
		'href',
		'/sign-in'
	);
	await expect(card.getByRole('link', { name: 'Sign in to bookmark' })).toHaveAttribute(
		'href',
		'/sign-in'
	);
});

test('a card opens its review, and Back to Explore returns to the same filter', async ({
	page
}) => {
	// `filter=all` matches every card, so this pins the query-string round trip without
	// depending on what the first card happens to be.
	await page.goto('/explore?filter=all');
	test.skip((await page.locator('article').count()) === 0, 'no public reviews in this database');

	await page
		.getByRole('link', { name: /^Open review:/ })
		.first()
		.click();
	await expect(page).toHaveURL(/\/review\/[0-9a-f-]+\?from=/);
	expect(new URL(page.url()).searchParams.get('from')).toBe('/explore?filter=all');

	await page.getByRole('link', { name: 'Back to Explore' }).click();
	await expect(page).toHaveURL(/\/explore\?filter=all$/);
});
