import type { PageServerLoad } from './$types';
import { listItems } from '$lib/features/items/service';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return { items: [] };
	return { items: await listItems(locals.user.id) };
};
