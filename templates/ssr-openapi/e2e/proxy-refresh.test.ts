import { test, expect, type APIResponse } from '@playwright/test';

// The refresh token e2e/mock-api.js accepts; any other access token than its own gets a 401.
const REFRESH_TOKEN =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.fake-refresh';
const EXPIRED_ACCESS_TOKEN = 'expired-access-token';

const setCookie = (response: APIResponse, name: string) =>
	response
		.headersArray()
		.filter((h) => h.name.toLowerCase() === 'set-cookie')
		.map((h) => h.value)
		.find((value) => value.startsWith(`${name}=`));

test.describe('API proxy token refresh', () => {
	test('refreshes an expired access token and keeps the refresh token', async ({ request }) => {
		const response = await request.get('/api/proxy/v1/users/me', {
			headers: { cookie: `access_token=${EXPIRED_ACCESS_TOKEN}; refresh_token=${REFRESH_TOKEN}` }
		});

		expect(response.status()).toBe(200);
		expect(await response.json()).toEqual({ username: 'admin' });
		expect(setCookie(response, 'access_token')).toMatch(
			/^access_token=(?!expired-access-token)[^;]+;/
		);
		expect(setCookie(response, 'refresh_token')).toBeUndefined();
	});

	test('clears the cookies when the refresh token is rejected', async ({ request }) => {
		const response = await request.get('/api/proxy/v1/users/me', {
			headers: { cookie: `access_token=${EXPIRED_ACCESS_TOKEN}; refresh_token=${REFRESH_TOKEN}x` }
		});

		expect(response.status()).toBe(401);
		expect(setCookie(response, 'access_token')).toMatch(/^access_token=;/);
		expect(setCookie(response, 'refresh_token')).toMatch(/^refresh_token=;/);
	});
});
