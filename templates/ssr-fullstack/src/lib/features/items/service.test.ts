import { describe, expect, it } from 'vitest';
import type { DbItem } from '#lib/server/db/schema.js';
import { createItemsService, ItemForbiddenError, ItemNotFoundError } from './service';
import { createInMemoryItemsRepository } from './testing/in-memory-repository';

function row(id: string, userId: string, createdAt = '2026-01-01T00:00:00Z'): DbItem {
	return {
		id,
		userId,
		title: `${id} title`,
		description: null,
		completed: false,
		createdAt: new Date(createdAt)
	};
}

function setup(seed: DbItem[] = [row('a', 'alice')]) {
	const repo = createInMemoryItemsRepository(seed);
	return { repo, service: createItemsService(repo) };
}

describe('items service', () => {
	it('lets the owner toggle and delete their item', async () => {
		const { repo, service } = setup();

		const toggled = await service.toggleItemCompletion('a', true, 'alice');
		expect(toggled).toMatchObject({ id: 'a', title: 'a title', completed: true });

		await service.deleteItemForUser('a', 'alice');
		expect(await repo.getById('a')).toBeUndefined();
	});

	it("forbids another user from toggling or deleting someone else's item", async () => {
		const { repo, service } = setup();

		await expect(service.toggleItemCompletion('a', true, 'bob')).rejects.toBeInstanceOf(
			ItemForbiddenError
		);
		await expect(service.deleteItemForUser('a', 'bob')).rejects.toBeInstanceOf(ItemForbiddenError);
		expect(await repo.getById('a')).toMatchObject({ completed: false });
	});

	it('reports a missing item as not found', async () => {
		const { service } = setup([]);

		await expect(service.toggleItemCompletion('missing', true, 'alice')).rejects.toBeInstanceOf(
			ItemNotFoundError
		);
		await expect(service.deleteItemForUser('missing', 'alice')).rejects.toBeInstanceOf(
			ItemNotFoundError
		);
	});

	it("lists only the requesting user's items, newest first, as Items", async () => {
		const { service } = setup([
			row('old', 'alice', '2026-01-01T00:00:00Z'),
			row('new', 'alice', '2026-02-01T00:00:00Z'),
			row('bobs', 'bob')
		]);

		const items = await service.listItems('alice');
		expect(items.map((item) => item.id)).toEqual(['new', 'old']);
		expect(items[0]).toEqual({
			id: 'new',
			title: 'new title',
			description: undefined,
			completed: false,
			createdAt: '2026-02-01T00:00:00.000Z'
		});
	});

	it('creates items owned by the requesting user', async () => {
		const { service } = setup([]);

		const created = await service.addItem({ title: 'Write the SOLID deck' }, 'alice');
		expect(created.title).toBe('Write the SOLID deck');
		expect(await service.listItems('alice')).toHaveLength(1);
		expect(await service.listItems('bob')).toHaveLength(0);
	});
});
