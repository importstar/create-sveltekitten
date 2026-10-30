import { redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { loginSchema } from '#lib/features/login/schema.js';
import { logger } from '#lib/server/logger.js';
import { setAuthTokens, isTokenExpired } from '#lib/utils/auth.js';

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
				logger.error({ err }, 'login failed: FastAPI unreachable');
				return undefined;
			});

		if (result?.data) {
			setAuthTokens(cookies, result.data.access_token, result.data.refresh_token);
			logger.debug({ outcome: 'success' }, 'login succeeded');
			throw redirect(303, '/home');
		}

		const status = result?.response.status;
		if (status === 400 || status === 401 || status === 403) {
			logger.debug({ outcome: 'invalid_credentials', status }, 'login rejected');
			return message(
				form,
				{
					type: 'error',
					text: 'Invalid username or password.'
				},
				{ status: 400 }
			);
		}

		logger.error({ status }, 'login failed: unexpected FastAPI response');
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
