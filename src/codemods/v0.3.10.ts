import type { Codemod } from './index.js';

type Replacement = [from: string, to: string];

function applyReplacements(replacements: Replacement[]) {
	return (content: string) =>
		replacements.reduce(
			(next, [from, to]) => (next.includes(from) ? next.replace(from, to) : next),
			content
		);
}

const SERVER_REPLACEMENTS: Replacement[] = [
	[
		`export async function getItems(userId?: string): Promise<DbItem[]> {
	if (userId) {
		return db
			.select()
			.from(items)
			.where(eq(items.userId, userId))
			.orderBy(desc(items.createdAt))
			.all();
	}
	return db.select().from(items).orderBy(desc(items.createdAt)).all();
}`,
		`export async function getItems(userId: string): Promise<DbItem[]> {
	return db
		.select()
		.from(items)
		.where(eq(items.userId, userId))
		.orderBy(desc(items.createdAt))
		.all();
}`
	],
	[
		`export async function insertItem(input: CreateItemInput, userId?: string): Promise<DbItem> {`,
		`export async function insertItem(input: CreateItemInput, userId: string): Promise<DbItem> {`
	],
	[`		userId: userId ?? null,\n`, `		userId,\n`]
];

const SERVICE_REPLACEMENTS: Replacement[] = [
	[
		`async function assertOwnedByUser(id: string, userId: string | undefined): Promise<DbItem> {`,
		`async function assertOwnedByUser(id: string, userId: string): Promise<DbItem> {`
	],
	[
		`	if (existing.userId && existing.userId !== userId) throw new ItemForbiddenError();`,
		`	if (existing.userId !== userId) throw new ItemForbiddenError();`
	],
	[
		`export async function listItems(userId?: string): Promise<DbItem[]> {`,
		`export async function listItems(userId: string): Promise<DbItem[]> {`
	],
	[
		`export async function addItem(input: CreateItemInput, userId?: string): Promise<DbItem> {`,
		`export async function addItem(input: CreateItemInput, userId: string): Promise<DbItem> {`
	],
	[
		`	completed: boolean,\n	userId?: string\n): Promise<DbItem> {`,
		`	completed: boolean,\n	userId: string\n): Promise<DbItem> {`
	],
	[
		`export async function deleteItemForUser(id: string, userId?: string): Promise<void> {`,
		`export async function deleteItemForUser(id: string, userId: string): Promise<void> {`
	]
];

const ROUTE_REPLACEMENTS: Replacement[] = [
	[
		`import { createItemSchema } from '$lib/features/items/schema';

export const GET: RequestHandler = async ({ locals }) => {
	const items = await listItems(locals.user?.id);`,
		`import { createItemSchema } from '$lib/features/items/schema';

// Items belong to a SQLite session user. Without one (anonymous, or FastAPI-JWT mode)
// there is no owner to scope by, so every method refuses up front.
function unauthorized() {
	return json({ error: 'Unauthorized' }, { status: 401 });
}

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return unauthorized();
	const items = await listItems(locals.user.id);`
	],
	[
		`export const POST: RequestHandler = async ({ request, locals }) => {
	try {`,
		`export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return unauthorized();
	try {`
	],
	[
		`const created = await addItem(result.data, locals.user?.id);`,
		`const created = await addItem(result.data, locals.user.id);`
	],
	[
		`export const PATCH: RequestHandler = async ({ request, locals }) => {
	try {`,
		`export const PATCH: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return unauthorized();
	try {`
	],
	[
		`toggleItemCompletion(id, completed, locals.user?.id);`,
		`toggleItemCompletion(id, completed, locals.user.id);`
	],
	[
		`export const DELETE: RequestHandler = async ({ request, url, locals }) => {
	try {`,
		`export const DELETE: RequestHandler = async ({ request, url, locals }) => {
	if (!locals.user) return unauthorized();
	try {`
	],
	[`await deleteItemForUser(id, locals.user?.id);`, `await deleteItemForUser(id, locals.user.id);`]
];

const PAGE_REPLACEMENTS: Replacement[] = [
	[
		`export const load: PageServerLoad = async ({ locals }) => {
	const dbItems = await getItems(locals.user?.id);`,
		`export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return { items: [] };
	const dbItems = await getItems(locals.user.id);`
	]
];

const AGENT_ROLE_ANCHOR =
	'- `src/routes/api/items/+server.ts` — API endpoint calling `service.ts` (which enforces per-item ownership) rather than the repository directly.\n';
const AGENT_ROLE_NOTE =
	'- The items example needs a SQLite session user (fullstack mode): `/api/items` returns 401 without `locals.user`, and every row is scoped to its owner. FastAPI-JWT projects keep their data in the FastAPI backend instead.\n';

const codemod: Codemod = {
	from: '0.3.9',
	to: '0.3.10',
	transforms: [
		{
			// Security: GET /api/items is not under (protected), so an anonymous request
			// reached getItems(undefined), which fell back to returning every user's items.
			// Separately, assertOwnedByUser let anyone mutate rows whose userId was null
			// (created without a session). Every method now requires locals.user, and
			// ownership is a strict equality check. Existing null-owner rows are left in
			// place; they are simply unreachable from here on.
			file: 'src/lib/features/items/server.ts',
			template: 'ssr',
			transform: applyReplacements(SERVER_REPLACEMENTS)
		},
		{
			file: 'src/lib/features/items/service.ts',
			template: 'ssr',
			transform: applyReplacements(SERVICE_REPLACEMENTS)
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
			transform: (content) =>
				content.includes(AGENT_ROLE_NOTE) || !content.includes(AGENT_ROLE_ANCHOR)
					? content
					: content.replace(AGENT_ROLE_ANCHOR, AGENT_ROLE_ANCHOR + AGENT_ROLE_NOTE)
		}
	]
};

export default codemod;
