import { test, expect } from '@playwright/test';

const MOCK_TOKENS = {
	access_token:
		'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.fake',
	refresh_token:
		'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.fake',
	token_type: 'bearer',
};

const MOCK_USER = {
	username: 'admin',
	name: 'Admin',
	id: 1,
	role: 'admin',
	is_active: true,
	email: 'admin@test.com',
	last_login_date: null,
	created_at: new Date().toISOString(),
};

test.describe('Login', () => {
	test('shows login form', async ({ page }) => {
		await page.goto('/login');
		await expect(page.getByLabel('Username')).toBeVisible();
		await expect(page.getByLabel('Password')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
	});

	test('redirects to /home on valid credentials', async ({ page }) => {
		await page.route('**/v1/auth/login', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(MOCK_TOKENS),
			})
		);
		await page.route('**/v1/users/me', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(MOCK_USER),
			})
		);

		await page.goto('/login');
		await page.getByLabel('Username').fill('admin');
		await page.getByLabel('Password').fill('secret');
		await page.getByRole('button', { name: 'Login' }).click();
		await expect(page).toHaveURL('/home');
	});

	test('shows error toast on invalid credentials', async ({ page }) => {
		await page.route('**/v1/auth/login', (route) =>
			route.fulfill({
				status: 401,
				contentType: 'application/json',
				body: JSON.stringify({ detail: 'Invalid credentials' }),
			})
		);

		await page.goto('/login');
		await page.getByLabel('Username').fill('wrong');
		await page.getByLabel('Password').fill('wrong');
		await page.getByRole('button', { name: 'Login' }).click();
		await expect(page.getByText('Invalid credentials')).toBeVisible();
	});
});
