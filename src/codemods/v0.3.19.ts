import type { Codemod } from './index.js';

type Replacement = [from: string, to: string];

function applyReplacements(replacements: Replacement[]) {
	return (content: string) =>
		replacements.reduce(
			(next, [from, to]) =>
				next.includes(from) && !next.includes(to) ? next.replace(from, to) : next,
			content
		);
}

const INDEX_REPLACEMENTS: Replacement[] = [
	[
		`export * from './queries';
export * as itemsApi from './api';
export type { ItemsApi } from './contract';
`,
		`export * from './queries';
export * from './filters';
export { itemsApi } from './api';
export type { ItemsApi } from './contract';
export { setItemsApi, useItemsApi } from './context';
export { createFakeItemsApi } from './testing/fake-items-api';
`
	]
];

const QUERIES_REPLACEMENTS: Replacement[] = [
	[
		`	lists: () => [...itemKeys.all, 'list'] as const,
	detail: (id: string) => [...itemKeys.all, 'detail', id] as const
};`,
		`	lists: () => [...itemKeys.all, 'list'] as const
};`
	]
];

const SSR_AGENT_ROLE_REPLACEMENTS: Replacement[] = [
	[
		`, query key factories, mutations, optimistic updates, and toasts.`,
		`, query key factories, mutations with cache invalidation, and toasts.`
	],
	[
		`with an interface describing the feature's client API surface.
`,
		`with an interface describing the feature's client API surface. Add \`contract.test.ts\` that runs the contract suite (see \`testing/items-api-contract.ts\`) against every implementation, including a fake in \`testing/\`.
`
	],
	[
		`(and \`+page.server.ts\` for server prefetching).`,
		`(and \`+page.server.ts\` for server prefetching — load through the service from \`$lib/server/services\`, never \`server.ts\`).`
	]
];

const SPA_AGENT_ROLE_REPLACEMENTS: Replacement[] = [
	[
		`, query key factories, mutations, optimistic updates, and toasts.`,
		`, query key factories, mutations with cache invalidation, and toasts.`
	],
	[
		`with an interface describing the feature's API surface.
`,
		`with an interface describing the feature's API surface. Add \`contract.test.ts\` that runs the contract suite (see \`testing/items-api-contract.ts\`) against every implementation, including a fake in \`testing/\`.
`
	]
];

const codemod: Codemod = {
	from: '0.3.18',
	to: '0.3.19',
	transforms: [
		{
			// `export * as itemsApi from './api'` exported the module namespace under the
			// name of the ItemsApi object, so the typed object was `itemsApi.itemsApi`.
			// The barrel now exports the object itself (its methods have the same names,
			// so `itemsApi.fetchItems()` callers keep working), plus the filters, the
			// context helpers and the fake.
			file: 'src/lib/features/items/index.ts',
			transform: applyReplacements(INDEX_REPLACEMENTS)
		},
		{
			// itemKeys.detail was defined but never used.
			file: 'src/lib/features/items/queries.ts',
			transform: applyReplacements(QUERIES_REPLACEMENTS)
		},
		{
			// agent-role.md claimed the items feature shows optimistic updates (there is
			// no onMutate anywhere), and its checklist didn't mention contract tests or
			// prefetching through the service. Agents copy what this file says.
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
