import fastapiClient from '$lib/api/fastapi-client';
import type { ItemsApi } from './contract';
import { toItem } from './dto';

type FastApiClient = typeof fastapiClient;

// FastAPI sends `{ detail: string }` for errors it raises and a list for validation errors.
function errorMessage(error: unknown, fallback: string): string {
	const detail = (error as { detail?: unknown } | undefined)?.detail;
	return typeof detail === 'string' ? detail : fallback;
}

/**
 * Items live in FastAPI, which owns their rules (ownership, validation); this only calls it
 * through `/api/proxy`. Pass another client to run against a fake backend in tests.
 */
export function createItemsApi(client: FastApiClient = fastapiClient): ItemsApi {
	return {
		async fetchItems() {
			const { data, error } = await client.GET('/v1/items');
			if (!data) throw new Error(errorMessage(error, 'Failed to fetch items'));
			return data.map(toItem);
		},

		async createItem(input) {
			const { data, error } = await client.POST('/v1/items', { body: input });
			if (!data) throw new Error(errorMessage(error, 'Failed to create item'));
			return toItem(data);
		},

		async toggleItem(id, completed) {
			const { data, error } = await client.PATCH('/v1/items/{item_id}', {
				params: { path: { item_id: id } },
				body: { completed }
			});
			if (!data) throw new Error(errorMessage(error, 'Failed to update item'));
			return toItem(data);
		},

		async deleteItem(id) {
			const { error, response } = await client.DELETE('/v1/items/{item_id}', {
				params: { path: { item_id: id } }
			});
			if (!response.ok) throw new Error(errorMessage(error, 'Failed to delete item'));
		}
	};
}

export const itemsApi: ItemsApi = createItemsApi();
