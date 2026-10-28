import type { DbItem } from '#lib/server/db/schema.js';
import { ApiError } from '#lib/utils/api-core.js';
import { toItemDto } from './dto';
import type { CreateItemInput, Item } from './schema';

// Each error carries its HTTP status, so routes map any of them with toErrorResponse()
// and a new error needs no change in the handlers.
export class ItemNotFoundError extends ApiError {
	constructor() {
		super('Item not found', 404, null);
	}
}

export class ItemForbiddenError extends ApiError {
	constructor() {
		super('Forbidden', 403, null);
	}
}

/**
 * What the service needs from storage. `server.ts` implements it with Drizzle;
 * tests pass an in-memory one (see `testing/in-memory-repository.ts`).
 */
export interface ItemsRepository {
	getById(id: string): Promise<DbItem | undefined>;
	listByUser(userId: string): Promise<DbItem[]>;
	insert(input: CreateItemInput, userId: string): Promise<DbItem>;
	setCompleted(id: string, completed: boolean): Promise<DbItem | undefined>;
	remove(id: string): Promise<void>;
}

export function createItemsService(repo: ItemsRepository) {
	async function assertOwnedByUser(id: string, userId: string): Promise<DbItem> {
		const existing = await repo.getById(id);
		if (!existing) throw new ItemNotFoundError();
		if (existing.userId !== userId) throw new ItemForbiddenError();
		return existing;
	}

	return {
		async listItems(userId: string): Promise<Item[]> {
			return (await repo.listByUser(userId)).map(toItemDto);
		},

		async addItem(input: CreateItemInput, userId: string): Promise<Item> {
			return toItemDto(await repo.insert(input, userId));
		},

		async toggleItemCompletion(id: string, completed: boolean, userId: string): Promise<Item> {
			await assertOwnedByUser(id, userId);
			const updated = await repo.setCompleted(id, completed);
			if (!updated) throw new ItemNotFoundError();
			return toItemDto(updated);
		},

		async deleteItemForUser(id: string, userId: string): Promise<void> {
			await assertOwnedByUser(id, userId);
			await repo.remove(id);
		}
	};
}

export type ItemsService = ReturnType<typeof createItemsService>;
