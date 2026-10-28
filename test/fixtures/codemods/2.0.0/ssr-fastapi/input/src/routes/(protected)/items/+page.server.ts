import type { PageServerLoad } from './$types';
import { toItem } from '$lib/features/items/dto';

export const load: PageServerLoad = async ({ locals }) => {
	const { data } = await locals.fastapiClient.GET('/v1/items');
	return { items: data ? data.map(toItem) : [] };
};
