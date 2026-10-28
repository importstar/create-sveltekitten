import { describe, expect, it } from 'vitest';
import type { ItemsApi } from '../contract';

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

/**
 * The promises every `ItemsApi` implementation makes beyond its type signature.
 * Run it against each implementation (real, mock, fake) from `contract.test.ts`.
 */
export function describeItemsApiContract(name: string, makeApi: () => ItemsApi) {
	describe(`${name} honours ItemsApi`, () => {
		it('createItem resolves with the persisted item', async () => {
			const api = makeApi();
			const created = await api.createItem({ title: 'Write the SOLID deck', description: 'v2' });

			expect(created).toMatchObject({
				title: 'Write the SOLID deck',
				description: 'v2',
				completed: false
			});
			expect(await api.fetchItems()).toContainEqual(created);
		});

		it('toggleItem resolves with the full persisted item, not a stub', async () => {
			const api = makeApi();
			const created = await api.createItem({ title: 'Write the SOLID deck' });
			const toggled = await api.toggleItem(created.id, true);

			expect(toggled).toEqual({ ...created, completed: true });
		});

		it('toggleItem rejects with a readable Error when the item does not exist', async () => {
			await expect(makeApi().toggleItem('missing', true)).rejects.toThrow(/not found/i);
		});

		it('deleteItem resolves only after the item is gone', async () => {
			const api = makeApi();
			const created = await api.createItem({ title: 'Delete me' });
			await api.deleteItem(created.id);

			expect((await api.fetchItems()).map((item) => item.id)).not.toContain(created.id);
		});

		it('fetchItems returns items newest first', async () => {
			const api = makeApi();
			const first = await api.createItem({ title: 'first' });
			await tick();
			const second = await api.createItem({ title: 'second' });

			const ids = (await api.fetchItems()).map((item) => item.id);
			expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
		});
	});
}
