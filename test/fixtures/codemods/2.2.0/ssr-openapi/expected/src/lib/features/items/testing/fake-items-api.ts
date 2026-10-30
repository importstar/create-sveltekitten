import type { ItemResponse } from '../dto';
import type { ItemsApi } from '../contract';
import type { Item } from '../schema';

/**
 * An in-memory `ItemsApi` for tests and component harnesses. It passes the same
 * contract tests as the real implementation, so it can't drift from it.
 */
export function createFakeItemsApi(seed: Item[] = []): ItemsApi {
	let items = seed.map((item) => ({ ...item }));
	let nextId = 0;

	return {
		async fetchItems() {
			return [...items]
				.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
				.map((item) => ({ ...item }));
		},
		async createItem(input) {
			const item: Item = {
				id: `fake-${++nextId}`,
				title: input.title,
				description: input.description,
				completed: false,
				createdAt: new Date().toISOString()
			};
			items.push(item);
			return { ...item };
		},
		async toggleItem(id, completed) {
			const item = items.find((i) => i.id === id);
			if (!item) throw new Error('Item not found');
			item.completed = completed;
			return { ...item };
		},
		async deleteItem(id) {
			items = items.filter((i) => i.id !== id);
		}
	};
}

/**
 * A `fetch` that answers the `/v1/items` endpoints of `openapi.json` from memory, so the real
 * `createItemsApi()` can run its contract tests without an API server.
 */
export function createFakeItemsApiFetch(): typeof fetch {
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
