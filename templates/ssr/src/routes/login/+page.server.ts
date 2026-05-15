import { redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { loginSchema } from '$lib/features/login/schema';
import { logger, sanitize } from '$lib/logger';
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
		const { fastapiClient } = locals;

		const form = await superValidate(request, zod4(loginSchema));

		logger.info({ formData: form.data }, 'Login form data');

		if (!form.valid) {
			return { form };
		}

		try {
			const result = await fastapiClient.POST('/v1/auth/login', {
				body: {
					username: form.data.username,
					password: form.data.password
				}
			});
			logger.info(sanitize({ result: result }), 'Login Result');

			if (result.data) {
				setAuthTokens(cookies, result.data.access_token, result.data.refresh_token);
			} else {
				logger.error({ error: result.error }, 'Login failed');
				return message(form, {
					type: 'error',
					text: 'Login failed. Please check your credentials and try again.'
				});
			}
		} catch (err) {
			logger.error({ error: err }, 'Login request failed');
			return message(form, {
				type: 'error',
				text: 'An error occurred while processing your request. Please try again later.',
				description: 'If the problem persists, please contact support.'
			});
		}
		return redirect(303, '/home');
	}
};
