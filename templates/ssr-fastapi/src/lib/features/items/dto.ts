import type { components } from '$lib/api/paths/fastapi';
import { itemSchema, type Item } from './schema';

export type ItemResponse = components['schemas']['ItemResponse'];

/**
 * The one place a FastAPI item becomes the `Item` shape the UI uses. Parsing makes a broken
 * response fail loudly here instead of reaching the UI as a half-filled item.
 */
export function toItem(response: ItemResponse): Item {
	return itemSchema.parse({
		id: response.id,
		title: response.title,
		description: response.description ?? undefined,
		completed: response.completed,
		createdAt: response.created_at
	});
}
