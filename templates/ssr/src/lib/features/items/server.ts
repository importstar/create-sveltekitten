import { db } from '$lib/server/db';
import { items, type DbItem } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { CreateItemInput } from './schema';

export async function getItems(userId?: string): Promise<DbItem[]> {
	if (userId) {
		return db
			.select()
			.from(items)
			.where(eq(items.userId, userId))
			.orderBy(desc(items.createdAt))
			.all();
	}
	return db.select().from(items).orderBy(desc(items.createdAt)).all();
}

export async function insertItem(input: CreateItemInput, userId?: string): Promise<DbItem> {
	const id = Math.random().toString(36).substring(2, 9);
	const newItem = {
		id,
		userId: userId ?? null,
		title: input.title,
		description: input.description ?? null,
		completed: false,
		createdAt: new Date()
	};

	db.insert(items).values(newItem).run();
	return newItem;
}

export async function updateItemCompletion(id: string, completed: boolean): Promise<void> {
	db.update(items).set({ completed }).where(eq(items.id, id)).run();
}

export async function removeItem(id: string): Promise<void> {
	db.delete(items).where(eq(items.id, id)).run();
}
