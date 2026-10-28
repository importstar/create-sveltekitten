import { redirect, type Actions } from '@sveltejs/kit';
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
