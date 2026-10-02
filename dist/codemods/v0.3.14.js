function applyReplacements(replacements) {
    return (content) => replacements.reduce((next, [from, to]) => next.includes(from) && !next.includes(to) ? next.replace(from, to) : next, content);
}
function createIfMissing(file) {
    return (content) => (content.trim() === '' ? file : content);
}
const FAKE_ITEMS_API_FILE = `import type { ItemsApi } from '../contract';
import type { Item } from '../schema';

/**
 * An in-memory \`ItemsApi\` for tests and component harnesses. It passes the same
 * contract tests as the real implementation, so it can't drift from it.
 */
export function createFakeItemsApi(seed: Item[] = []): ItemsApi {
	let items = seed.map((item) => ({ ...item }));
	let nextId = 0;

	return {
		async fetchItems() {
			return [...items]
				.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
				.map((item) => ({ ...item }));
		},
		async createItem(input) {
			const item: Item = {
				id: \`fake-\${++nextId}\`,
				title: input.title,
				description: input.description,
				completed: false,
				createdAt: new Date().toISOString()
			};
			items.push(item);
			return { ...item };
		},
		async toggleItem(id, completed) {
			const item = items.find((i) => i.id === id);
			if (!item) throw new Error('Item not found');
			item.completed = completed;
			return { ...item };
		},
		async deleteItem(id) {
			items = items.filter((i) => i.id !== id);
		}
	};
}
`;
const CONTRACT_SUITE_FILE = `import { describe, expect, it } from 'vitest';
import type { ItemsApi } from '../contract';

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

/**
 * The promises every \`ItemsApi\` implementation makes beyond its type signature.
 * Run it against each implementation (real, mock, fake) from \`contract.test.ts\`.
 */
export function describeItemsApiContract(name: string, makeApi: () => ItemsApi) {
	describe(\`\${name} honours ItemsApi\`, () => {
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
`;
const SSR_CONTRACT_TEST_FILE = `import { describeItemsApiContract } from './testing/items-api-contract';
import { createFakeItemsApi } from './testing/fake-items-api';

// The real \`itemsApi\` (api.ts) talks to /api/items over fetch; its server side is
// covered by service.test.ts. Add it here once you run tests against a live server.
describeItemsApiContract('createFakeItemsApi', () => createFakeItemsApi());
`;
const SPA_CONTRACT_TEST_FILE = `import { describeItemsApiContract } from './testing/items-api-contract';
import { createFakeItemsApi } from './testing/fake-items-api';
import { createMockItemsApi } from './api';

describeItemsApiContract('createFakeItemsApi', () => createFakeItemsApi());
describeItemsApiContract('createMockItemsApi (api.ts)', () => createMockItemsApi([], 0));
`;
const OLD_SPA_API_FILE = `import type { Item, CreateItemInput } from './schema';
import type { ItemsApi } from './contract';

/**
 * In-memory store providing an immediate working example out-of-the-box.
 * Replace with your backend API calls (e.g. via client) when connecting to real endpoints.
 */
let mockItems: Item[] = [
	{
		id: '1',
		title: 'Explore SvelteKitten template',
		description: 'Learn about Svelte 5 runes, TanStack Query, and feature structure.',
		completed: true,
		createdAt: new Date(Date.now() - 3600000).toISOString()
	},
	{
		id: '2',
		title: 'Build your awesome feature',
		description: 'Duplicate this feature folder or replace it with your domain logic.',
		completed: false,
		createdAt: new Date().toISOString()
	}
];

export async function fetchItems(): Promise<Item[]> {
	await new Promise((resolve) => setTimeout(resolve, 200));
	return [...mockItems];
}

export async function createItem(input: CreateItemInput): Promise<Item> {
	await new Promise((resolve) => setTimeout(resolve, 200));
	const newItem: Item = {
		id: Math.random().toString(36).substring(2, 9),
		title: input.title,
		description: input.description,
		completed: false,
		createdAt: new Date().toISOString()
	};
	mockItems = [newItem, ...mockItems];
	return newItem;
}

export async function toggleItem(id: string, completed: boolean): Promise<Item> {
	await new Promise((resolve) => setTimeout(resolve, 150));
	const item = mockItems.find((i) => i.id === id);
	if (!item) throw new Error('Item not found');
	item.completed = completed;
	return { ...item };
}

export async function deleteItem(id: string): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 150));
	mockItems = mockItems.filter((i) => i.id !== id);
}

export const itemsApi: ItemsApi = { fetchItems, createItem, toggleItem, deleteItem };
`;
const NEW_SPA_API_FILE = `import type { Item, CreateItemInput } from './schema';
import type { ItemsApi } from './contract';

/**
 * In-memory store providing an immediate working example out-of-the-box.
 * Replace with your backend API calls (e.g. via client) when connecting to real endpoints.
 */
const DEMO_ITEMS: Item[] = [
	{
		id: '1',
		title: 'Explore SvelteKitten template',
		description: 'Learn about Svelte 5 runes, TanStack Query, and feature structure.',
		completed: true,
		createdAt: new Date(Date.now() - 3600000).toISOString()
	},
	{
		id: '2',
		title: 'Build your awesome feature',
		description: 'Duplicate this feature folder or replace it with your domain logic.',
		completed: false,
		createdAt: new Date().toISOString()
	}
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A mock \`ItemsApi\` over an in-memory list. \`latencyMs\` simulates the network; tests pass 0. */
export function createMockItemsApi(seed: Item[] = [], latencyMs = 200): ItemsApi {
	let mockItems = seed.map((item) => ({ ...item }));

	return {
		async fetchItems() {
			await wait(latencyMs);
			return [...mockItems]
				.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
				.map((item) => ({ ...item }));
		},
		async createItem(input: CreateItemInput) {
			await wait(latencyMs);
			const newItem: Item = {
				id: Math.random().toString(36).substring(2, 9),
				title: input.title,
				description: input.description,
				completed: false,
				createdAt: new Date().toISOString()
			};
			mockItems = [newItem, ...mockItems];
			return { ...newItem };
		},
		async toggleItem(id: string, completed: boolean) {
			await wait(latencyMs);
			const item = mockItems.find((i) => i.id === id);
			if (!item) throw new Error('Item not found');
			item.completed = completed;
			return { ...item };
		},
		async deleteItem(id: string) {
			await wait(latencyMs);
			mockItems = mockItems.filter((i) => i.id !== id);
		}
	};
}

export const itemsApi: ItemsApi = createMockItemsApi(DEMO_ITEMS);
export const { fetchItems, createItem, toggleItem, deleteItem } = itemsApi;
`;
const SSR_AGENT_ROLE_REPLACEMENTS = [
    [
        `├── contract.ts         # Interface for the feature's client API surface (e.g. \`ItemsApi\`)
`,
        `├── contract.ts         # Interface for the feature's client API surface (e.g. \`ItemsApi\`)
├── contract.test.ts    # Runs the shared contract suite (testing/items-api-contract.ts) against every implementation
`
    ],
    [
        `├── testing/            # Test doubles (e.g. in-memory repository)
`,
        `├── testing/            # Test doubles (in-memory repository, fake ItemsApi) and the shared contract suite
`
    ],
    [
        `swap it for a fake in tests without touching \`queries.ts\`.
`,
        `swap it for a fake in tests without touching \`queries.ts\`.
- The contract is more than the type: e.g. \`toggleItem\` must resolve with the full persisted item, failures reject with a readable \`Error\`. \`testing/items-api-contract.ts\` spells those promises out as tests, and \`contract.test.ts\` runs them against every implementation — including the fake in \`testing/fake-items-api.ts\`, so a test double can't drift from the real thing.
`
    ]
];
const SPA_AGENT_ROLE_REPLACEMENTS = [
    [
        `├── contract.ts         # Interface for the feature's API surface (e.g. \`ItemsApi\`)
`,
        `├── contract.ts         # Interface for the feature's API surface (e.g. \`ItemsApi\`)
├── contract.test.ts    # Runs the shared contract suite (testing/items-api-contract.ts) against every implementation
`
    ],
    [
        `├── components/         # Feature-specific Svelte 5 components
`,
        `├── testing/            # Fake ItemsApi and the shared contract suite
├── components/         # Feature-specific Svelte 5 components
`
    ],
    [
        `swap it for a fake in tests without touching \`queries.ts\`.
`,
        `swap it for a fake in tests without touching \`queries.ts\`.

The contract is more than the type: e.g. \`toggleItem\` must resolve with the full persisted item, failures reject with a readable \`Error\`. \`testing/items-api-contract.ts\` spells those promises out as tests, and \`contract.test.ts\` runs them against every implementation — including the fake in \`testing/fake-items-api.ts\`, so a test double can't drift from the real thing.
`
    ]
];
const codemod = {
    from: '0.3.13',
    to: '0.3.14',
    transforms: [
        {
            // ItemsApi's type can't express its behavioural promises (v0.3.1 shipped a
            // toggleItem that resolved with a fabricated item and still type-checked).
            // A shared contract suite now runs against every implementation, including
            // a fake for tests, so no implementation — real or fake — can quietly break it.
            file: 'src/lib/features/items/testing/fake-items-api.ts',
            create: true,
            transform: createIfMissing(FAKE_ITEMS_API_FILE)
        },
        {
            file: 'src/lib/features/items/testing/items-api-contract.ts',
            create: true,
            transform: createIfMissing(CONTRACT_SUITE_FILE)
        },
        {
            file: 'src/lib/features/items/contract.test.ts',
            template: 'ssr',
            create: true,
            transform: createIfMissing(SSR_CONTRACT_TEST_FILE)
        },
        {
            file: 'src/lib/features/items/contract.test.ts',
            template: 'spa',
            create: true,
            transform: createIfMissing(SPA_CONTRACT_TEST_FILE)
        },
        {
            // The SPA mock kept its list in module state (so tests couldn't get a fresh
            // instance) and returned its demo seed oldest-first, against the contract.
            // It is now a createMockItemsApi(seed, latencyMs) factory; the named exports
            // stay. Only an unmodified api.ts is replaced.
            file: 'src/lib/features/items/api.ts',
            template: 'spa',
            transform: (content) => (content === OLD_SPA_API_FILE ? NEW_SPA_API_FILE : content)
        },
        {
            file: 'agent-role.md',
            template: 'ssr',
            transform: applyReplacements(SSR_AGENT_ROLE_REPLACEMENTS)
        },
        {
            file: 'agent-role.md',
            template: 'spa',
            transform: applyReplacements(SPA_AGENT_ROLE_REPLACEMENTS)
        }
    ]
};
export default codemod;
