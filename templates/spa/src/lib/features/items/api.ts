import type { Item, CreateItemInput } from './schema';
import type { ItemsApi } from './contract';

/**
 * In-memory store providing an immediate working example out-of-the-box.
 * Replace with your backend API calls (e.g. via client) when connecting to real endpoints.
 */
const DEMO_ITEMS: Item[] = [
	{
		id: '1',
		title: 'Explore SvelteKitten template',
		description: 'Learn about Svelte 5 runes, TanStack Query, and feature structure.',
		completed: true,
		createdAt: new Date(Date.now() - 3600000).toISOString()
	},
	{
		id: '2',
		title: 'Build your awesome feature',
		description: 'Duplicate this feature folder or replace it with your domain logic.',
		completed: false,
		createdAt: new Date().toISOString()
	}
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A mock `ItemsApi` over an in-memory list. `latencyMs` simulates the network; tests pass 0. */
export function createMockItemsApi(seed: Item[] = [], latencyMs = 200): ItemsApi {
	let mockItems = seed.map((item) => ({ ...item }));

	return {
		async fetchItems() {
			await wait(latencyMs);
			return [...mockItems]
				.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
				.map((item) => ({ ...item }));
		},
		async createItem(input: CreateItemInput) {
			await wait(latencyMs);
			const newItem: Item = {
				id: Math.random().toString(36).substring(2, 9),
				title: input.title,
				description: input.description,
				completed: false,
				createdAt: new Date().toISOString()
			};
			mockItems = [newItem, ...mockItems];
			return { ...newItem };
		},
		async toggleItem(id: string, completed: boolean) {
			await wait(latencyMs);
			const item = mockItems.find((i) => i.id === id);
			if (!item) throw new Error('Item not found');
			item.completed = completed;
			return { ...item };
		},
		async deleteItem(id: string) {
			await wait(latencyMs);
			mockItems = mockItems.filter((i) => i.id !== id);
		}
	};
}

export const itemsApi: ItemsApi = createMockItemsApi(DEMO_ITEMS);
export const { fetchItems, createItem, toggleItem, deleteItem } = itemsApi;
