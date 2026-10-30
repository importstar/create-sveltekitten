import type { ItemResponse } from '../dto';

/**
 * A `fetch` that answers the `/v1/items` endpoints of `fastapi.json` from memory, so the real
 * `createItemsApi()` can run its contract tests without a FastAPI server.
 */
export function createFakeFastApiItemsFetch(): typeof fetch {
	const items = new Map<string, ItemResponse>();
	let nextId = 0;

	const json = (body: unknown, status = 200) =>
		new Response(JSON.stringify(body), {
			status,
			headers: { 'content-type': 'application/json' }
		});

	return async (input, init) => {
		const request = new Request(input, init);
		const { pathname } = new URL(request.url);

		if (pathname === '/v1/items' && request.method === 'GET') {
			return json([...items.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)));
		}
		if (pathname === '/v1/items' && request.method === 'POST') {
			const body = await request.json();
			const item: ItemResponse = {
				id: `api-${++nextId}`,
				title: body.title,
				description: body.description ?? null,
				completed: false,
				created_at: new Date().toISOString()
			};
			items.set(item.id, item);
			return json(item, 201);
		}

		const id = /^\/v1\/items\/([^/]+)$/.exec(pathname)?.[1];
		const item = id === undefined ? undefined : items.get(decodeURIComponent(id));
		if (id !== undefined && !item) return json({ detail: 'Item not found' }, 404);
		if (item && request.method === 'PATCH') {
			item.completed = (await request.json()).completed;
			return json(item);
		}
		if (item && request.method === 'DELETE') {
			items.delete(item.id);
			return new Response(null, { status: 204 });
		}
		return json({ detail: 'Not Found' }, 404);
	};
}
