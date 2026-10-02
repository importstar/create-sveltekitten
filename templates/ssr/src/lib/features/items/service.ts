import {
	getItemById,
	getItems,
	insertItem,
	removeItem,
	updateItemCompletion,
	type DbItem
} from './server';
import { toItemDto } from './dto';
import type { CreateItemInput, Item } from './schema';

export class ItemNotFoundError extends Error {}
export class ItemForbiddenError extends Error {}

async function assertOwnedByUser(id: string, userId: string): Promise<DbItem> {
	const existing = await getItemById(id);
	if (!existing) throw new ItemNotFoundError();
	if (existing.userId !== userId) throw new ItemForbiddenError();
	return existing;
}

export async function listItems(userId: string): Promise<Item[]> {
	return (await getItems(userId)).map(toItemDto);
}

export async function addItem(input: CreateItemInput, userId: string): Promise<Item> {
	return toItemDto(await insertItem(input, userId));
}

export async function toggleItemCompletion(
	id: string,
	completed: boolean,
	userId: string
): Promise<Item> {
	await assertOwnedByUser(id, userId);
	const updated = await updateItemCompletion(id, completed);
	if (!updated) throw new ItemNotFoundError();
	return toItemDto(updated);
}

export async function deleteItemForUser(id: string, userId: string): Promise<void> {
	await assertOwnedByUser(id, userId);
	await removeItem(id);
}
