import type { Codemod } from './index.js';

type Replacement = [from: string, to: string];

/**
 * These edits depend on each other (the markup uses names the script edit introduces),
 * so apply all of them or none: a component that no longer matches is left untouched.
 */
function applyAllOrNothing(replacements: Replacement[]) {
	return (content: string) =>
		replacements.every(([from]) => content.includes(from))
			? replacements.reduce((next, [from, to]) => next.replace(from, to), content)
			: content;
}

const FILTERS_FILE = `import type { Item } from './schema';

export interface ItemFilter {
	label: string;
	predicate: (item: Item) => boolean;
	/** Shown by the empty state when no item matches. */
	empty: string;
}

/** The list filters, in display order. Add an entry to get its button, count and empty state. */
export const itemFilters = {
	all: {
		label: 'All',
		predicate: () => true,
		empty: 'No items created yet. Add one to get started!'
	},
	active: {
		label: 'Active',
		predicate: (item) => !item.completed,
		empty: 'No active items. All tasks done!'
	},
	completed: {
		label: 'Completed',
		predicate: (item) => item.completed,
		empty: 'No completed items yet.'
	}
} satisfies Record<string, ItemFilter>;

export type ItemFilterKey = keyof typeof itemFilters;

export const itemFilterKeys = Object.keys(itemFilters) as ItemFilterKey[];
`;

const ITEM_LIST_REPLACEMENTS: Replacement[] = [
	[
		`	import ItemEmptyState from './item-empty-state.svelte';
`,
		`	import ItemEmptyState from './item-empty-state.svelte';
	import { itemFilters, itemFilterKeys, type ItemFilterKey } from '../filters';
`
	],
	[
		`	let filter = $state<'all' | 'active' | 'completed'>('all');

	const items = $derived(itemsQuery.data ?? []);
	const totalCount = $derived(items.length);
	const activeCount = $derived(items.filter((i) => !i.completed).length);
	const completedCount = $derived(items.filter((i) => i.completed).length);

	const filteredItems = $derived(
		items.filter((item) => {
			if (filter === 'active') return !item.completed;
			if (filter === 'completed') return item.completed;
			return true;
		})
	);
`,
		`	let filter = $state<ItemFilterKey>('all');

	const items = $derived(itemsQuery.data ?? []);
	const counts = $derived(
		Object.fromEntries(
			itemFilterKeys.map((key) => [key, items.filter(itemFilters[key].predicate).length])
		) as Record<ItemFilterKey, number>
	);

	const filteredItems = $derived(items.filter(itemFilters[filter].predicate));
`
	],
	[
		`			<button
				type="button"
				class="cursor-pointer rounded-md px-2.5 py-1 font-medium transition-colors {filter === 'all'
					? 'bg-background text-foreground shadow-xs'
					: 'text-muted-foreground hover:text-foreground'}"
				onclick={() => (filter = 'all')}
			>
				All ({totalCount})
			</button>
			<button
				type="button"
				class="cursor-pointer rounded-md px-2.5 py-1 font-medium transition-colors {filter === 'active'
					? 'bg-background text-foreground shadow-xs'
					: 'text-muted-foreground hover:text-foreground'}"
				onclick={() => (filter = 'active')}
			>
				Active ({activeCount})
			</button>
			<button
				type="button"
				class="cursor-pointer rounded-md px-2.5 py-1 font-medium transition-colors {filter === 'completed'
					? 'bg-background text-foreground shadow-xs'
					: 'text-muted-foreground hover:text-foreground'}"
				onclick={() => (filter = 'completed')}
			>
				Completed ({completedCount})
			</button>
`,
		`			{#each itemFilterKeys as key (key)}
				<button
					type="button"
					class="cursor-pointer rounded-md px-2.5 py-1 font-medium transition-colors {filter === key
						? 'bg-background text-foreground shadow-xs'
						: 'text-muted-foreground hover:text-foreground'}"
					onclick={() => (filter = key)}
				>
					{itemFilters[key].label} ({counts[key]})
				</button>
			{/each}
`
	]
];

const ITEM_EMPTY_STATE_REPLACEMENTS: Replacement[] = [
	[
		`	import InboxIcon from '@lucide/svelte/icons/inbox';

	interface Props {
		filter: 'all' | 'active' | 'completed';
	}

	let { filter }: Props = $props();

	const message = $derived(
		filter === 'completed'
			? 'No completed items yet.'
			: filter === 'active'
				? 'No active items. All tasks done!'
				: 'No items created yet. Add one to get started!'
	);
`,
		`	import InboxIcon from '@lucide/svelte/icons/inbox';
	import { itemFilters, type ItemFilterKey } from '../filters';

	interface Props {
		filter: ItemFilterKey;
	}

	let { filter }: Props = $props();

	const message = $derived(itemFilters[filter].empty);
`
	]
];

const codemod: Codemod = {
	from: '0.3.15',
	to: '0.3.16',
	transforms: [
		{
			// The 'all' | 'active' | 'completed' union was declared in two components,
			// matched with an if-chain in one and nested ternaries in the other, and each
			// button was hand-copied, so a new filter meant five edits in two files. The
			// filters are now one record in filters.ts that both components read from.
			file: 'src/lib/features/items/filters.ts',
			create: true,
			transform: (content) => (content.trim() === '' ? FILTERS_FILE : content)
		},
		{
			file: 'src/lib/features/items/components/item-list.svelte',
			transform: applyAllOrNothing(ITEM_LIST_REPLACEMENTS)
		},
		{
			file: 'src/lib/features/items/components/item-empty-state.svelte',
			transform: applyAllOrNothing(ITEM_EMPTY_STATE_REPLACEMENTS)
		}
	]
};

export default codemod;
