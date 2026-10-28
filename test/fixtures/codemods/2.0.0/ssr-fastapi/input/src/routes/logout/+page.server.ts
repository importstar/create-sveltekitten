import { redirect } from '@sveltejs/kit';
import { clearCookieTokens } from '$lib/utils/auth';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ cookies }) => {
		clearCookieTokens(cookies);
		throw redirect(303, '/login');
	}
};
