import { expect, test } from '@playwright/test';

test('signed-out visitor to /review/new is redirected to sign-in', async ({ page }) => {
	await page.goto('/review/new');
	await expect(page).toHaveURL(/\/sign-in/);
});
