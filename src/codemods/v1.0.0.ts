import type { Codemod } from './index.js';
import { replaceFile } from './helpers.js';

// 1.0.0 splits the SSR template into templates/ssr (shared) plus one overlay per mode. Existing
// projects keep the files of the other mode (codemods never delete); they only get the files
// whose content changed for their own mode.

const OLD_FASTAPI_LOGIN = `import { redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { loginSchema } from '$lib/features/login/schema';
import { logger } from '$lib/logger';
import { setAuthTokens, isTokenExpired } from '$lib/utils/auth';
import { db } from '$lib/server/db';
import { authenticate } from '$lib/server/auth/users';
import { createSession, generateSessionToken, setSessionCookie } from '$lib/server/auth/session';

export const load = (async ({ cookies, locals }) => {
	if (locals.user) {
		throw redirect(303, '/home');
	}
	const refreshToken = cookies.get('refresh_token');
	if (refreshToken && !isTokenExpired(refreshToken)) {
		throw redirect(303, '/home');
	}

	const form = await superValidate(zod4(loginSchema));

	return { form };
}) satisfies PageServerLoad;

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const { fastapiClient } = locals;
		const form = await superValidate(request, zod4(loginSchema));

		if (!form.valid) {
			return { form };
		}

		// Try FastAPI first if BACKEND_API_URL is configured and not default placeholder
		const backendUrl = process.env.BACKEND_API_URL;
		if (backendUrl && backendUrl !== 'http://localhost:9000') {
			try {
				const result = await fastapiClient.POST('/v1/auth/login', {
					body: {
						username: form.data.username,
						password: form.data.password,
						strategy: 'jwt'
					}
				});
				logger.inspect('FastAPI Login Result', result);

				if (result.data) {
					setAuthTokens(cookies, result.data.access_token, result.data.refresh_token);
					throw redirect(303, '/home');
				}
			} catch (err) {
				if ((err as any)?.status === 303) throw err;
				logger.inspect('FastAPI login failed, checking local database', err);
			}
		}

		try {
			const user = await authenticate(db, form.data.username, form.data.password);
			if (!user) {
				return message(
					form,
					{
						type: 'error',
						text: 'Invalid username or password.'
					},
					{ status: 400 }
				);
			}

			const token = generateSessionToken();
			const session = await createSession(token, user.id);
			setSessionCookie(cookies, token, session.expiresAt);
		} catch (err) {
			logger.inspect('Local login error', err);
			return message(
				form,
				{
					type: 'error',
					text: 'An error occurred during authentication. Please try again.'
				},
				{ status: 500 }
			);
		}

		throw redirect(303, '/home');
	}
};
`;

const NEW_FASTAPI_LOGIN = `import { redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { loginSchema } from '$lib/features/login/schema';
import { logger } from '$lib/logger';
import { setAuthTokens, isTokenExpired } from '$lib/utils/auth';

export const load = (async ({ cookies }) => {
	const refreshToken = cookies.get('refresh_token');
	if (refreshToken && !isTokenExpired(refreshToken)) {
		throw redirect(303, '/home');
	}

	const form = await superValidate(zod4(loginSchema));

	return { form };
}) satisfies PageServerLoad;

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const form = await superValidate(request, zod4(loginSchema));

		if (!form.valid) {
			return { form };
		}

		// FastAPI owns users and credentials; this app only stores the tokens it hands out.
		const result = await locals.fastapiClient
			.POST('/v1/auth/login', {
				body: {
					username: form.data.username,
					password: form.data.password,
					strategy: 'jwt'
				}
			})
			.catch((err: unknown) => {
				logger.error({ err }, 'FastAPI login request failed');
				return undefined;
			});

		if (result?.data) {
			setAuthTokens(cookies, result.data.access_token, result.data.refresh_token);
			throw redirect(303, '/home');
		}

		const status = result?.response.status;
		if (status === 400 || status === 401 || status === 403) {
			return message(
				form,
				{
					type: 'error',
					text: 'Invalid username or password.'
				},
				{ status: 400 }
			);
		}

		logger.error({ status }, 'FastAPI login failed');
		return message(
			form,
			{
				type: 'error',
				text: 'An error occurred during authentication. Please try again.'
			},
			{ status: 502 }
		);
	}
};
`;

const OLD_FULLSTACK_LOGIN = `import { redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { loginSchema } from '$lib/features/login/schema';
import { logger } from '$lib/logger';
import { setAuthTokens } from '$lib/utils/auth';
import { db } from '$lib/server/db';
import { authenticate } from '$lib/server/auth/users';
import { createSession, generateSessionToken, setSessionCookie } from '$lib/server/auth/session';

export const load = (async ({ locals }) => {
	if (locals.user) {
		throw redirect(303, '/home');
	}

	const form = await superValidate(zod4(loginSchema));

	return { form };
}) satisfies PageServerLoad;

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const { fastapiClient } = locals;
		const form = await superValidate(request, zod4(loginSchema));

		if (!form.valid) {
			return { form };
		}

		// Try FastAPI first if BACKEND_API_URL is configured and not default placeholder
		const backendUrl = process.env.BACKEND_API_URL;
		if (backendUrl && backendUrl !== 'http://localhost:9000') {
			try {
				const result = await fastapiClient.POST('/v1/auth/login', {
					body: {
						username: form.data.username,
						password: form.data.password,
						strategy: 'jwt'
					}
				});
				logger.inspect('FastAPI Login Result', result);

				if (result.data) {
					setAuthTokens(cookies, result.data.access_token, result.data.refresh_token);
					throw redirect(303, '/home');
				}
			} catch (err) {
				if ((err as any)?.status === 303) throw err;
				logger.inspect('FastAPI login failed, checking local database', err);
			}
		}

		try {
			const user = await authenticate(db, form.data.username, form.data.password);
			if (!user) {
				return message(
					form,
					{
						type: 'error',
						text: 'Invalid username or password.'
					},
					{ status: 400 }
				);
			}

			const token = generateSessionToken();
			const session = await createSession(token, user.id);
			setSessionCookie(cookies, token, session.expiresAt);
		} catch (err) {
			logger.inspect('Local login error', err);
			return message(
				form,
				{
					type: 'error',
					text: 'An error occurred during authentication. Please try again.'
				},
				{ status: 500 }
			);
		}

		throw redirect(303, '/home');
	}
};
`;

const NEW_FULLSTACK_LOGIN = `import { redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { loginSchema } from '$lib/features/login/schema';
import { logger } from '$lib/logger';
import { db } from '$lib/server/db';
import { authenticate } from '$lib/server/auth/users';
import { createSession, generateSessionToken, setSessionCookie } from '$lib/server/auth/session';

export const load = (async ({ locals }) => {
	if (locals.user) {
		throw redirect(303, '/home');
	}

	const form = await superValidate(zod4(loginSchema));

	return { form };
}) satisfies PageServerLoad;

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await superValidate(request, zod4(loginSchema));

		if (!form.valid) {
			return { form };
		}

		try {
			const user = await authenticate(db, form.data.username, form.data.password);
			if (!user) {
				return message(
					form,
					{
						type: 'error',
						text: 'Invalid username or password.'
					},
					{ status: 400 }
				);
			}

			const token = generateSessionToken();
			const session = await createSession(token, user.id);
			setSessionCookie(cookies, token, session.expiresAt);
		} catch (err) {
			logger.inspect('Local login error', err);
			return message(
				form,
				{
					type: 'error',
					text: 'An error occurred during authentication. Please try again.'
				},
				{ status: 500 }
			);
		}

		throw redirect(303, '/home');
	}
};
`;

const OLD_LOGIN_E2E = `import { test, expect } from '@playwright/test';

const VALID = { username: 'admin', password: 'secret' };
const INVALID = { username: 'wrong', password: 'wrongpass' };

test.describe('Login', () => {
	test('shows login form', async ({ page }) => {
		await page.goto('/login');
		await expect(page.getByLabel('Username')).toBeVisible();
		await expect(page.getByLabel('Password')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
	});

	test('redirects to /home on valid credentials', async ({ page }) => {
		await page.goto('/login');
		await page.getByLabel('Username').fill(VALID.username);
		await page.getByLabel('Password').fill(VALID.password);
		await page.getByRole('button', { name: 'Login' }).click();
		await expect(page).toHaveURL('/home');
	});

	test('shows error toast on invalid credentials', async ({ page }) => {
		await page.goto('/login');
		await page.getByLabel('Username').fill(INVALID.username);
		await page.getByLabel('Password').fill(INVALID.password);
		await page.getByRole('button', { name: 'Login' }).click();
		await expect(page.getByText('Login Failed', { exact: true })).toBeVisible();
	});
});
`;

const NEW_LOGIN_E2E = `import { test, expect } from '@playwright/test';

const VALID = { username: 'admin', password: 'secret' };
const INVALID = { username: 'wrong', password: 'wrongpass' };

test.describe('Login', () => {
	test('shows login form', async ({ page }) => {
		await page.goto('/login');
		await expect(page.getByLabel('Username')).toBeVisible();
		await expect(page.getByLabel('Password')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
	});

	test('redirects to /home on valid credentials', async ({ page }) => {
		await page.goto('/login');
		await page.getByLabel('Username').fill(VALID.username);
		await page.getByLabel('Password').fill(VALID.password);
		await page.getByRole('button', { name: 'Login' }).click();
		await expect(page).toHaveURL('/home');
	});

	test('shows error toast on invalid credentials', async ({ page }) => {
		await page.goto('/login');
		await page.getByLabel('Username').fill(INVALID.username);
		await page.getByLabel('Password').fill(INVALID.password);
		await page.getByRole('button', { name: 'Login' }).click();
		await expect(page.getByText('Login Failed', { exact: true })).toBeVisible();
		await expect(page.getByText('Invalid username or password.')).toBeVisible();

		// No session of any kind: no cookie was set, and protected pages still send you to /login.
		const authCookies = ['session_id', 'access_token', 'refresh_token'];
		const cookies = await page.context().cookies();
		expect(cookies.filter((c) => authCookies.includes(c.name))).toEqual([]);
		await page.goto('/home');
		await expect(page).toHaveURL('/login');
	});
});
`;

const codemod: Codemod = {
	from: '0.3.24',
	to: '1.0.0',
	transforms: [
		{
			file: 'src/routes/login/+page.server.ts',
			template: 'ssr',
			ssrMode: 'fastapi',
			transform: replaceFile(OLD_FASTAPI_LOGIN, NEW_FASTAPI_LOGIN),
		},
		{
			file: 'src/routes/login/+page.server.ts',
			template: 'ssr',
			ssrMode: 'fullstack',
			transform: replaceFile(OLD_FULLSTACK_LOGIN, NEW_FULLSTACK_LOGIN),
		},
		{
			file: 'e2e/login.test.ts',
			template: 'ssr',
			transform: replaceFile(OLD_LOGIN_E2E, NEW_LOGIN_E2E),
		},
	],
};

export default codemod;
