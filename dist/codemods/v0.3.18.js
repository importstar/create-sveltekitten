/**
 * The edits in each file depend on each other, so apply all of them or none. Skip a
 * file that already has every result (some edits insert after an anchor that stays).
 */
function applyAllOrNothing(replacements) {
    return (content) => replacements.every(([from]) => content.includes(from)) &&
        !replacements.every(([, to]) => content.includes(to))
        ? replacements.reduce((next, [from, to]) => next.replace(from, to), content)
        : content;
}
function applyReplacements(replacements) {
    return (content) => replacements.reduce((next, [from, to]) => next.includes(from) && !next.includes(to) ? next.replace(from, to) : next, content);
}
function createIfMissing(file) {
    return (content) => (content.trim() === '' ? file : content);
}
const ITEMS_CONTEXT_FILE = `import { createContext } from 'svelte';
import { itemsApi as defaultItemsApi } from './api';
import type { ItemsApi } from './contract';

const [getItemsApi, setItemsApi, hasItemsApi] = createContext<ItemsApi>();

/**
 * Provides an \`ItemsApi\` to every component below. The root layout provides the real
 * one; a test or component harness can provide \`createFakeItemsApi()\` instead.
 */
export { setItemsApi };

/** The provided \`ItemsApi\`, or the real one when none was provided. Call during component init. */
export function useItemsApi(): ItemsApi {
	return hasItemsApi() ? getItemsApi() : defaultItemsApi;
}
`;
const HEALTH_CONTEXT_FILE = `import { createContext } from 'svelte';
import { healthApi as defaultHealthApi } from './api';
import type { HealthApi } from './contract';

const [getHealthApi, setHealthApi, hasHealthApi] = createContext<HealthApi>();

/** Provides a \`HealthApi\` to every component below (the root layout provides the real one). */
export { setHealthApi };

/** The provided \`HealthApi\`, or the real one when none was provided. Call during component init. */
export function useHealthApi(): HealthApi {
	return hasHealthApi() ? getHealthApi() : defaultHealthApi;
}
`;
const ITEMS_QUERIES_REPLACEMENTS = [
    [
        `import { itemsApi as defaultItemsApi } from './api';
import type { ItemsApi } from './contract';
`,
        `import { useItemsApi } from './context';
import type { ItemsApi } from './contract';
`
    ],
    [
        `	initialDataGetter?: () => Item[] | undefined,
	itemsApi: ItemsApi = defaultItemsApi
`,
        `	initialDataGetter?: () => Item[] | undefined,
	itemsApi: ItemsApi = useItemsApi()
`
    ],
    [
        `export function useCreateItem(itemsApi: ItemsApi = defaultItemsApi) {`,
        `export function useCreateItem(itemsApi: ItemsApi = useItemsApi()) {`
    ],
    [
        `export function useToggleItem(itemsApi: ItemsApi = defaultItemsApi) {`,
        `export function useToggleItem(itemsApi: ItemsApi = useItemsApi()) {`
    ],
    [
        `export function useDeleteItem(itemsApi: ItemsApi = defaultItemsApi) {`,
        `export function useDeleteItem(itemsApi: ItemsApi = useItemsApi()) {`
    ]
];
const HEALTH_QUERIES_REPLACEMENTS = [
    [
        `import { healthApi as defaultHealthApi } from './api';
import type { HealthApi } from './contract';
`,
        `import { useHealthApi } from './context';
import type { HealthApi } from './contract';
`
    ],
    [
        `export const useHealthStatus = (healthApi: HealthApi = defaultHealthApi) => {`,
        `export const useHealthStatus = (healthApi: HealthApi = useHealthApi()) => {`
    ]
];
const ROOT_LAYOUT_REPLACEMENTS = [
    [
        `	import { SvelteQueryDevtools } from '@tanstack/svelte-query-devtools';
`,
        `	import { SvelteQueryDevtools } from '@tanstack/svelte-query-devtools';
	import { itemsApi } from '$lib/features/items/api';
	import { setItemsApi } from '$lib/features/items/context';
	import { healthApi } from '$lib/features/health/api';
	import { setHealthApi } from '$lib/features/health/context';
`
    ],
    [
        `	let { children, data } = $props();
`,
        `	let { children, data } = $props();

	// Provide each feature's API to the whole app. Swap in fakes here (or in a test
	// harness) to run the UI without a backend; hooks read these via context.
	setItemsApi(itemsApi);
	setHealthApi(healthApi);
`
    ]
];
const HOME_PAGE_REPLACEMENTS = [
    [
        `	import { healthApi } from '$lib/features/health/api';
`,
        `	import { useHealthApi } from '$lib/features/health/context';
`
    ],
    [
        `	let { data }: PageProps = $props();
`,
        `	let { data }: PageProps = $props();

	const healthApi = useHealthApi();
`
    ]
];
const SSR_AGENT_ROLE_REPLACEMENTS = [
    [
        `├── queries.ts          # TanStack Query key factory + use<Query>/use<Mutation> hooks, injected with the contract implementation
`,
        `├── context.ts          # createContext for the contract: set<Feature>Api() / use<Feature>Api() (falls back to api.ts)
├── queries.ts          # TanStack Query key factory + use<Query>/use<Mutation> hooks, reading the contract implementation from context
`
    ],
    [
        `Each hook in \`queries.ts\` takes the implementation as an optional parameter defaulting to the real one, e.g. \`useItems(initialDataGetter?, itemsApi: ItemsApi = defaultItemsApi)\` — swap it for a fake in tests without touching \`queries.ts\`.`,
        `The implementation is provided through context: the root layout (\`src/routes/+layout.svelte\`) calls \`setItemsApi(itemsApi)\`, and each hook defaults to it, e.g. \`useItems(initialDataGetter?, itemsApi: ItemsApi = useItemsApi())\`. A test or component harness calls \`setItemsApi(createFakeItemsApi())\` to run a whole component tree against a fake, or passes an implementation to a single hook — no change to \`queries.ts\` either way.`
    ],
    [
        `each taking the contract implementation as an optional parameter (default to the real \`api.ts\` implementation).`,
        `each taking the contract implementation as an optional parameter that defaults to \`useYourFeatureApi()\` from \`context.ts\`. Provide the real implementation once in \`src/routes/+layout.svelte\` with \`setYourFeatureApi(yourFeatureApi)\`.`
    ]
];
const SPA_AGENT_ROLE_REPLACEMENTS = [
    [
        `├── queries.ts          # TanStack Query key factory + use<Query>/use<Mutation> hooks, injected with the contract implementation
`,
        `├── context.ts          # createContext for the contract: set<Feature>Api() / use<Feature>Api() (falls back to api.ts)
├── queries.ts          # TanStack Query key factory + use<Query>/use<Mutation> hooks, reading the contract implementation from context
`
    ],
    [
        `Each hook takes the implementation as an optional parameter defaulting to the real one, e.g. \`useItems(initialDataGetter?, itemsApi: ItemsApi = defaultItemsApi)\` — swap it for a fake in tests without touching \`queries.ts\`.`,
        `The implementation is provided through context: the root layout (\`src/routes/+layout.svelte\`) calls \`setItemsApi(itemsApi)\`, and each hook defaults to it, e.g. \`useItems(initialDataGetter?, itemsApi: ItemsApi = useItemsApi())\`. A test or component harness calls \`setItemsApi(createFakeItemsApi())\` to run a whole component tree against a fake, or passes an implementation to a single hook — no change to \`queries.ts\` either way.`
    ],
    [
        `each taking the contract implementation as an optional parameter (default to the real \`api.ts\` implementation).`,
        `each taking the contract implementation as an optional parameter that defaults to \`useYourFeatureApi()\` from \`context.ts\`. Provide the real implementation once in \`src/routes/+layout.svelte\` with \`setYourFeatureApi(yourFeatureApi)\`.`
    ]
];
const codemod = {
    from: '0.3.17',
    to: '0.3.18',
    transforms: [
        {
            // Hooks defaulted their contract parameter straight to api.ts, and no
            // component ever passed one, so the implementation could be swapped when
            // calling a hook but not when rendering <ItemList> in a test or harness.
            // The root layout now provides each feature's API via createContext, and the
            // hooks default to it. useItemsApi()/useHealthApi() fall back to the real
            // implementation, so a layout this codemod can't patch keeps working.
            file: 'src/lib/features/items/context.ts',
            create: true,
            transform: createIfMissing(ITEMS_CONTEXT_FILE)
        },
        {
            file: 'src/lib/features/health/context.ts',
            create: true,
            transform: createIfMissing(HEALTH_CONTEXT_FILE)
        },
        {
            file: 'src/lib/features/items/queries.ts',
            transform: applyAllOrNothing(ITEMS_QUERIES_REPLACEMENTS)
        },
        {
            file: 'src/lib/features/health/queries.ts',
            transform: applyAllOrNothing(HEALTH_QUERIES_REPLACEMENTS)
        },
        {
            file: 'src/routes/+layout.svelte',
            transform: applyAllOrNothing(ROOT_LAYOUT_REPLACEMENTS)
        },
        {
            file: 'src/routes/(protected)/home/+page.svelte',
            template: 'ssr',
            transform: applyAllOrNothing(HOME_PAGE_REPLACEMENTS)
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
