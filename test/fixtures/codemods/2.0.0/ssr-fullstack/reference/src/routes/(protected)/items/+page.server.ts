import type { PageServerLoad } from './$types';
import { itemsService } from '#lib/server/services.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return { items: [] };
	return { items: await itemsService.listItems(locals.user.id) };
};
