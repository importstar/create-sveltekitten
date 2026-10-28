import { redirectIfAuthenticated } from '#lib/guards/auth.js';
import type { PageLoad } from './$types';

export const load = (async () => {
	await redirectIfAuthenticated('/home');
}) satisfies PageLoad;
