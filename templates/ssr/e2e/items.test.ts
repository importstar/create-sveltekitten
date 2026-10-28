import { test, expect } from '@playwright/test';

test('a signed-in user adds an item and sees it after a reload', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('secret');
	await page.getByRole('button', { name: 'Login' }).click();
	await expect(page).toHaveURL('/home');

	const title = `e2e item ${Date.now()}`;
	await page.goto('/items');
	await page.getByLabel('Title *').fill(title);
	await page.getByRole('button', { name: 'Add Item' }).click();
	await expect(page.getByText(`Created "${title}"`)).toBeVisible();

	await page.reload();
	await expect(page.getByText(title, { exact: true })).toBeVisible();
});
