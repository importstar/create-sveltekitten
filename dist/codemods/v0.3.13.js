function applyReplacements(replacements) {
    return (content) => replacements.reduce((next, [from, to]) => (next.includes(from) ? next.replace(from, to) : next), content);
}
function createIfMissing(file) {
    return (content) => (content.trim() === '' ? file : content);
}
const OLD_SERVICE_FILE = `import {
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
`;
const NEW_SERVICE_FILE = `import type { DbItem } from '$lib/server/db/schema';
import { toItemDto } from './dto';
import type { CreateItemInput, Item } from './schema';

export class ItemNotFoundError extends Error {}
export class ItemForbiddenError extends Error {}

/**
 * What the service needs from storage. \`server.ts\` implements it with Drizzle;
 * tests pass an in-memory one (see \`testing/in-memory-repository.ts\`).
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
`;
const SERVICES_FILE = `// Composition root: wires each feature's service to its real repository. Routes import
// services from here; tests build their own with an in-memory repository instead.
import { createItemsService } from '$lib/features/items/service';
import { drizzleItemsRepository } from '$lib/features/items/server';

export const itemsService = createItemsService(drizzleItemsRepository);
`;
const IN_MEMORY_REPOSITORY_FILE = `import type { DbItem } from '$lib/server/db/schema';
import type { ItemsRepository } from '../service';

/** An \`ItemsRepository\` backed by a Map, for testing the service without SQLite. */
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
				id: \`mem-\${++nextId}\`,
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
`;
const SERVICE_TEST_FILE = `import { describe, expect, it } from 'vitest';
import type { DbItem } from '$lib/server/db/schema';
import { createItemsService, ItemForbiddenError, ItemNotFoundError } from './service';
import { createInMemoryItemsRepository } from './testing/in-memory-repository';

function row(id: string, userId: string, createdAt = '2026-01-01T00:00:00Z'): DbItem {
	return {
		id,
		userId,
		title: \`\${id} title\`,
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
`;
const SCHEMA_IMPORT = `import type { CreateItemInput } from './schema';\n`;
const REPOSITORY_IMPORT = `import type { ItemsRepository } from './service';\n`;
const DRIZZLE_REPOSITORY = `

export const drizzleItemsRepository: ItemsRepository = {
	getById: getItemById,
	listByUser: getItems,
	insert: insertItem,
	setCompleted: updateItemCompletion,
	remove: removeItem
};
`;
const ROUTE_REPLACEMENTS = [
    [
        `import {
	addItem,
	deleteItemForUser,
	ItemForbiddenError,
	ItemNotFoundError,
	listItems,
	toggleItemCompletion
} from '$lib/features/items/service';
`,
        `import { ItemForbiddenError, ItemNotFoundError } from '$lib/features/items/service';
import { itemsService } from '$lib/server/services';
`
    ],
    [
        `await listItems(locals.user.id)`,
        `await itemsService.listItems(locals.user.id)`
    ],
    [
        `await addItem(result.data, locals.user.id)`,
        `await itemsService.addItem(result.data, locals.user.id)`
    ],
    [
        `await toggleItemCompletion(id, completed, locals.user.id)`,
        `await itemsService.toggleItemCompletion(id, completed, locals.user.id)`
    ],
    [
        `await deleteItemForUser(id, locals.user.id)`,
        `await itemsService.deleteItemForUser(id, locals.user.id)`
    ]
];
const PAGE_REPLACEMENTS = [
    [
        `import { listItems } from '$lib/features/items/service';`,
        `import { itemsService } from '$lib/server/services';`
    ],
    [
        `await listItems(locals.user.id)`,
        `await itemsService.listItems(locals.user.id)`
    ]
];
const AGENT_ROLE_REPLACEMENTS = [
    [
        `├── server.ts           # Repository: raw Drizzle database queries only — no business rules
├── service.ts          # Use-case layer: calls server.ts, enforces authorization/business rules
`,
        `├── server.ts           # Repository: raw Drizzle database queries only — no business rules — implements service.ts's repository interface
├── service.ts          # Use-case layer: repository interface + create<Feature>Service(repo), enforces authorization/business rules
├── service.test.ts     # Unit tests for the rules, run against an in-memory repository (no SQLite)
├── testing/            # Test doubles (e.g. in-memory repository)
`
    ],
    [
        `This is where authorization/business rules belong — e.g. verifying the requesting user owns a row before it's mutated or deleted. **Route handlers call \`service.ts\`, never \`server.ts\` directly.**
`,
        `This is where authorization/business rules belong — e.g. verifying the requesting user owns a row before it's mutated or deleted. **Route handlers call the service, never \`server.ts\` directly.**
- \`service.ts\` doesn't import \`server.ts\`: it declares the repository interface it needs (e.g. \`ItemsRepository\`) and exports a factory, \`createItemsService(repo)\`. \`server.ts\` implements the interface with Drizzle, and \`src/lib/server/services.ts\` (the composition root) wires the two: \`export const itemsService = createItemsService(drizzleItemsRepository)\`. Routes import \`itemsService\` from there; tests build a service over an in-memory repository, so the rules are testable without SQLite.
`
    ],
    [
        `- \`src/routes/api/items/+server.ts\` — API endpoint calling \`service.ts\` (which enforces per-item ownership) rather than the repository directly.
`,
        `- \`src/routes/api/items/+server.ts\` — API endpoint calling \`itemsService\` (which enforces per-item ownership) rather than the repository directly.
- \`src/lib/features/items/service.test.ts\` — Ownership rules tested against \`testing/in-memory-repository.ts\`.
`
    ],
    [
        `3. **Service**: Create \`src/lib/features/your-feature/service.ts\` — use-case functions that call \`server.ts\` and enforce authorization (e.g. ownership checks) before mutating/deleting.
`,
        `3. **Service**: Create \`src/lib/features/your-feature/service.ts\` — a repository interface plus a \`createYourFeatureService(repo)\` factory whose use cases enforce authorization (e.g. ownership checks) before mutating/deleting. Implement the interface in \`server.ts\`, wire it in \`src/lib/server/services.ts\`, and test the rules in \`service.test.ts\` with an in-memory repository.
`
    ],
    [
        `(calling \`service.ts\`, never \`server.ts\` directly)`,
        `(calling the service from \`$lib/server/services\`, never \`server.ts\` directly)`
    ]
];
const codemod = {
    from: '0.3.12',
    to: '0.3.13',
    transforms: [
        {
            // service.ts imported its repository functions from server.ts, which opens
            // SQLite at import time, so the ownership rules couldn't be tested without a
            // real database. The service now declares an ItemsRepository interface and a
            // createItemsService(repo) factory; server.ts implements the interface and
            // $lib/server/services.ts wires them. Only an unmodified service.ts is
            // replaced. If yours was customised it is left as is, and services.ts will
            // fail loudly at startup until you move your rules into createItemsService.
            file: 'src/lib/features/items/service.ts',
            template: 'ssr',
            transform: (content) => (content === OLD_SERVICE_FILE ? NEW_SERVICE_FILE : content)
        },
        {
            file: 'src/lib/features/items/server.ts',
            template: 'ssr',
            transform: (content) => {
                let next = content;
                if (!next.includes(REPOSITORY_IMPORT) && next.includes(SCHEMA_IMPORT)) {
                    next = next.replace(SCHEMA_IMPORT, SCHEMA_IMPORT + REPOSITORY_IMPORT);
                }
                if (!next.includes('export const drizzleItemsRepository')) {
                    next = next.trimEnd() + DRIZZLE_REPOSITORY;
                }
                return next;
            }
        },
        {
            file: 'src/lib/server/services.ts',
            template: 'ssr',
            create: true,
            transform: createIfMissing(SERVICES_FILE)
        },
        {
            file: 'src/lib/features/items/testing/in-memory-repository.ts',
            template: 'ssr',
            create: true,
            transform: createIfMissing(IN_MEMORY_REPOSITORY_FILE)
        },
        {
            file: 'src/lib/features/items/service.test.ts',
            template: 'ssr',
            create: true,
            transform: createIfMissing(SERVICE_TEST_FILE)
        },
        {
            file: 'src/routes/api/items/+server.ts',
            template: 'ssr',
            transform: applyReplacements(ROUTE_REPLACEMENTS)
        },
        {
            file: 'src/routes/(protected)/items/+page.server.ts',
            template: 'ssr',
            transform: applyReplacements(PAGE_REPLACEMENTS)
        },
        {
            file: 'agent-role.md',
            template: 'ssr',
            transform: applyReplacements(AGENT_ROLE_REPLACEMENTS)
        }
    ]
};
export default codemod;
