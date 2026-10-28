import type { Item } from './schema';

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
