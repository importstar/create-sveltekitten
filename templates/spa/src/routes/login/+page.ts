import { redirectIfAuthenticated } from '$lib/guards/auth';
import type { PageLoad } from './$types';

export const load = (async () => {
  await redirectIfAuthenticated('/');
}) satisfies PageLoad;
