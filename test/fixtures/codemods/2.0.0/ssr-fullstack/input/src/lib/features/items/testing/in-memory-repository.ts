import type { DbItem } from '$lib/server/db/schema';
import type { ItemsRepository } from '../service';

/** An `ItemsRepository` backed by a Map, for testing the service without SQLite. */
export function createInMemoryItemsRepository(seed: DbItem[] = []): ItemsRepository {
	const rows = new Map(seed.map((row) => [row.id, { ...row }]));
	let nextId = 0;

	return {
		async getById(id) {
			return rows.get(id);
		},
		async listByUser(userId) {
			return [...rows.values()]
				.filter((row) => row.userId === userId)
				.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		},
		async insert(input, userId) {
			const row: DbItem = {
				id: `mem-${++nextId}`,
				userId,
				title: input.title,
				description: input.description ?? null,
				completed: false,
				createdAt: new Date()
			};
			rows.set(row.id, row);
			return row;
		},
		async setCompleted(id, completed) {
			const row = rows.get(id);
			if (!row) return undefined;
			row.completed = completed;
			return row;
		},
		async remove(id) {
			rows.delete(id);
		}
	};
}
