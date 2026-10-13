import { expect, test } from '@playwright/test';

/** Signed out only. The project has no Clerk auth fixture, so the signed-in feed (cards, tabs,
 *  the sidebar, the bottom tab bar) is verified by hand rather than asserted here — see the
 *  plan's Verification section. What these cover is the part a crawler or a first-time visitor
 *  actually reaches. */
test('signed-out home shows the marketing state', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Get started' })).toBeVisible();
});

test('signed-out home has no app chrome', async ({ page }) => {
	await page.goto('/');
	// The bottom tab bar is inside <Show when="signed-in">, so it must not render here — if it
	// leaked out, a signed-out visitor would get a nav full of dead buttons.
	await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
	await expect(page.getByRole('navigation', { name: 'Feed' })).toHaveCount(0);
});
