const OLD_API_FILE = `import type { Item, CreateItemInput } from './schema';
import type { ItemsApi } from './contract';

export async function fetchItems(): Promise<Item[]> {
	const res = await fetch('/api/items');
	if (!res.ok) throw new Error('Failed to fetch items');
	const data = await res.json();
	return data.map((d: any) => ({
		...d,
		description: d.description ?? undefined,
		createdAt: typeof d.createdAt === 'string' ? d.createdAt : new Date(d.createdAt).toISOString()
	}));
}

export async function createItem(input: CreateItemInput): Promise<Item> {
	const res = await fetch('/api/items', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.error || 'Failed to create item');
	}
	const data = await res.json();
	return {
		...data,
		description: data.description ?? undefined,
		createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date(data.createdAt).toISOString()
	};
}

export async function toggleItem(id: string, completed: boolean): Promise<Item> {
	const res = await fetch('/api/items', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ id, completed })
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.error || 'Failed to update item');
	}
	const data = await res.json();
	return {
		...data,
		description: data.description ?? undefined,
		createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date(data.createdAt).toISOString()
	};
}

export async function deleteItem(id: string): Promise<void> {
	const res = await fetch(\`/api/items?id=\${encodeURIComponent(id)}\`, {
		method: 'DELETE'
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.error || 'Failed to delete item');
	}
}

export const itemsApi: ItemsApi = { fetchItems, createItem, toggleItem, deleteItem };
`;
const NEW_API_FILE = `import { itemSchema, type Item, type CreateItemInput } from './schema';
import type { ItemsApi } from './contract';

// The server sends \`Item\`s (see dto.ts). Parsing makes a broken response fail loudly
// here instead of reaching the UI as a half-filled item.
const itemListSchema = itemSchema.array();

export async function fetchItems(): Promise<Item[]> {
	const res = await fetch('/api/items');
	if (!res.ok) throw new Error('Failed to fetch items');
	return itemListSchema.parse(await res.json());
}

export async function createItem(input: CreateItemInput): Promise<Item> {
	const res = await fetch('/api/items', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.error || 'Failed to create item');
	}
	return itemSchema.parse(await res.json());
}

export async function toggleItem(id: string, completed: boolean): Promise<Item> {
	const res = await fetch('/api/items', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ id, completed })
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.error || 'Failed to update item');
	}
	return itemSchema.parse(await res.json());
}

export async function deleteItem(id: string): Promise<void> {
	const res = await fetch(\`/api/items?id=\${encodeURIComponent(id)}\`, {
		method: 'DELETE'
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.error || 'Failed to delete item');
	}
}

export const itemsApi: ItemsApi = { fetchItems, createItem, toggleItem, deleteItem };
`;
const OLD_PAGE_FILE = `import type { PageServerLoad } from './$types';
import { getItems } from '$lib/features/items/server';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return { items: [] };
	const dbItems = await getItems(locals.user.id);
	const items = dbItems.map((item) => ({
		id: item.id,
		title: item.title,
		description: item.description ?? undefined,
		completed: Boolean(item.completed),
		createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : new Date(item.createdAt).toISOString()
	}));
	return { items };
};
`;
const NEW_PAGE_FILE = `import type { PageServerLoad } from './$types';
import { listItems } from '$lib/features/items/service';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return { items: [] };
	return { items: await listItems(locals.user.id) };
};
`;
const DTO_FILE = `import type { DbItem } from '$lib/server/db/schema';
import type { Item } from './schema';

/** The one place a database row becomes the \`Item\` shape clients receive. */
export function toItemDto(row: DbItem): Item {
	return {
		id: row.id,
		title: row.title,
		description: row.description ?? undefined,
		completed: row.completed,
		createdAt: row.createdAt.toISOString()
	};
}
`;
const SERVICE_REPLACEMENTS = [
    [
        `} from './server';\nimport type { CreateItemInput } from './schema';`,
        `} from './server';\nimport { toItemDto } from './dto';\nimport type { CreateItemInput, Item } from './schema';`
    ],
    [
        `export async function listItems(userId: string): Promise<DbItem[]> {
	return getItems(userId);
}`,
        `export async function listItems(userId: string): Promise<Item[]> {
	return (await getItems(userId)).map(toItemDto);
}`
    ],
    [
        `export async function addItem(input: CreateItemInput, userId: string): Promise<DbItem> {
	return insertItem(input, userId);
}`,
        `export async function addItem(input: CreateItemInput, userId: string): Promise<Item> {
	return toItemDto(await insertItem(input, userId));
}`
    ],
    [
        `	userId: string
): Promise<DbItem> {
	await assertOwnedByUser(id, userId);
	const updated = await updateItemCompletion(id, completed);
	if (!updated) throw new ItemNotFoundError();
	return updated;
}`,
        `	userId: string
): Promise<Item> {
	await assertOwnedByUser(id, userId);
	const updated = await updateItemCompletion(id, completed);
	if (!updated) throw new ItemNotFoundError();
	return toItemDto(updated);
}`
    ]
];
/** Swap a whole file only when it is still exactly the previous template version. */
function replaceIfUnmodified(oldFile, newFile) {
    return (content) => (content === oldFile ? newFile : content);
}
const codemod = {
    from: '0.3.10',
    to: '0.3.11',
    transforms: [
        {
            // The DbItem → Item mapping (`?? undefined`, `toISOString()`) was copied into
            // api.ts three times and (protected)/items/+page.server.ts once. It now lives
            // in toItemDto(), the service returns Items, and the page loads through the
            // service instead of importing the repository (server.ts) directly.
            file: 'src/lib/features/items/dto.ts',
            template: 'ssr',
            create: true,
            transform: (content) => (content.trim() === '' ? DTO_FILE : content)
        },
        {
            file: 'src/lib/features/items/service.ts',
            template: 'ssr',
            transform: (content) => SERVICE_REPLACEMENTS.reduce((next, [from, to]) => (next.includes(from) ? next.replace(from, to) : next), content)
        },
        {
            file: 'src/routes/(protected)/items/+page.server.ts',
            template: 'ssr',
            transform: replaceIfUnmodified(OLD_PAGE_FILE, NEW_PAGE_FILE)
        },
        {
            // With the server guaranteeing the Item shape, the client parses responses
            // with itemSchema instead of patching fields up: a broken response now fails
            // loudly rather than reaching the UI as a fabricated item.
            file: 'src/lib/features/items/api.ts',
            template: 'ssr',
            transform: replaceIfUnmodified(OLD_API_FILE, NEW_API_FILE)
        }
    ]
};
export default codemod;
