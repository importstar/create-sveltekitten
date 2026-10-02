import { itemSchema, type Item, type CreateItemInput } from './schema';
import type { ItemsApi } from './contract';

// The server sends `Item`s (see dto.ts). Parsing makes a broken response fail loudly
// here instead of reaching the UI as a half-filled item.
const itemListSchema = itemSchema.array();

export async function fetchItems(): Promise<Item[]> {
	const res = await fetch('/api/items');
	if (!res.ok) throw new Error('Failed to fetch items');
	return itemListSchema.parse(await res.json());
}

export async function createItem(input: CreateItemInput): Promise<Item> {
	const res = await fetch('/api/items', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.error || 'Failed to create item');
	}
	return itemSchema.parse(await res.json());
}

export async function toggleItem(id: string, completed: boolean): Promise<Item> {
	const res = await fetch('/api/items', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ id, completed })
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.error || 'Failed to update item');
	}
	return itemSchema.parse(await res.json());
}

export async function deleteItem(id: string): Promise<void> {
	const res = await fetch(`/api/items?id=${encodeURIComponent(id)}`, {
		method: 'DELETE'
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.error || 'Failed to delete item');
	}
}

export const itemsApi: ItemsApi = { fetchItems, createItem, toggleItem, deleteItem };
