import type { DbItem } from '#lib/server/db/schema.js';
import type { Item } from './schema';

/** The one place a database row becomes the `Item` shape clients receive. */
export function toItemDto(row: DbItem): Item {
	return {
		id: row.id,
		title: row.title,
		description: row.description ?? undefined,
		completed: row.completed,
		createdAt: row.createdAt.toISOString()
	};
}
