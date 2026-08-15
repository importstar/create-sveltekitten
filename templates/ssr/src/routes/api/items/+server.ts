import { json, type RequestHandler } from '@sveltejs/kit';
import { getItems, insertItem, updateItemCompletion, removeItem } from '$lib/features/items/server';
import { createItemSchema } from '$lib/features/items/schema';

export const GET: RequestHandler = async ({ locals }) => {
	const items = await getItems(locals.user?.id);
	return json(items);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await request.json();
		const result = createItemSchema.safeParse(body);
		if (!result.success) {
			return json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
		}
		const created = await insertItem(result.data, locals.user?.id);
		return json(created, { status: 201 });
	} catch {
		return json({ error: 'Failed to create item' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { id, completed } = body;
		if (typeof id !== 'string' || typeof completed !== 'boolean') {
			return json({ error: 'Invalid payload' }, { status: 400 });
		}
		await updateItemCompletion(id, completed);
		return json({ success: true });
	} catch {
		return json({ error: 'Failed to update item' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ request, url }) => {
	try {
		const id = url.searchParams.get('id') || (await request.json().catch(() => ({}))).id;
		if (!id || typeof id !== 'string') {
			return json({ error: 'Item ID is required' }, { status: 400 });
		}
		await removeItem(id);
		return json({ success: true });
	} catch {
		return json({ error: 'Failed to delete item' }, { status: 500 });
	}
};
