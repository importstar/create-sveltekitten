import { json, type RequestHandler } from '@sveltejs/kit';
import { itemsService } from '$lib/server/services';
import { toErrorResponse } from '$lib/server/http';
import { createItemSchema } from '$lib/features/items/schema';

// Items belong to a SQLite session user. Without one (anonymous, or FastAPI-JWT mode)
// there is no owner to scope by, so every method refuses up front.
function unauthorized() {
	return json({ error: 'Unauthorized' }, { status: 401 });
}

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return unauthorized();
	const items = await itemsService.listItems(locals.user.id);
	return json(items);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return unauthorized();
	try {
		const body = await request.json();
		const result = createItemSchema.safeParse(body);
		if (!result.success) {
			return json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
		}
		const created = await itemsService.addItem(result.data, locals.user.id);
		return json(created, { status: 201 });
	} catch (err) {
		return toErrorResponse(err, 'Failed to create item');
	}
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return unauthorized();
	try {
		const body = await request.json();
		const { id, completed } = body;
		if (typeof id !== 'string' || typeof completed !== 'boolean') {
			return json({ error: 'Invalid payload' }, { status: 400 });
		}
		const updated = await itemsService.toggleItemCompletion(id, completed, locals.user.id);
		return json(updated);
	} catch (err) {
		return toErrorResponse(err, 'Failed to update item');
	}
};

export const DELETE: RequestHandler = async ({ request, url, locals }) => {
	if (!locals.user) return unauthorized();
	try {
		const id = url.searchParams.get('id') || (await request.json().catch(() => ({}))).id;
		if (!id || typeof id !== 'string') {
			return json({ error: 'Item ID is required' }, { status: 400 });
		}
		await itemsService.deleteItemForUser(id, locals.user.id);
		return json({ success: true });
	} catch (err) {
		return toErrorResponse(err, 'Failed to delete item');
	}
};
