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
