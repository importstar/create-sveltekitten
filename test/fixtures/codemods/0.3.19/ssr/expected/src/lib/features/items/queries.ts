import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
import { useItemsApi } from './context';
import type { ItemsApi } from './contract';
import type { CreateItemInput, Item } from './schema';
import { toast } from 'svelte-sonner';

export const itemKeys = {
	all: ['items'] as const,
	lists: () => [...itemKeys.all, 'list'] as const
};

export function useItems(
	initialDataGetter?: () => Item[] | undefined,
	itemsApi: ItemsApi = useItemsApi()
) {
	return createQuery(() => ({
		queryKey: itemKeys.lists(),
		queryFn: itemsApi.fetchItems,
		initialData: initialDataGetter ? initialDataGetter() : undefined,
		staleTime: 1000 * 60
	}));
}

export function useCreateItem(itemsApi: ItemsApi = useItemsApi()) {
	const queryClient = useQueryClient();
	return createMutation(() => ({
		mutationFn: (input: CreateItemInput) => itemsApi.createItem(input),
		onSuccess: (newItem) => {
			queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
			toast.success(`Created "${newItem.title}"`);
		},
		onError: (error: Error) => {
			toast.error(error.message || 'Failed to create item');
		}
	}));
}

export function useToggleItem(itemsApi: ItemsApi = useItemsApi()) {
	const queryClient = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
			itemsApi.toggleItem(id, completed),
		onSuccess: (updatedItem) => {
			queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
			toast.success(
				updatedItem.completed
					? `Completed "${updatedItem.title}"`
					: `Marked "${updatedItem.title}" as active`
			);
		},
		onError: (error: Error) => {
			toast.error(error.message || 'Failed to update item');
		}
	}));
}

export function useDeleteItem(itemsApi: ItemsApi = useItemsApi()) {
	const queryClient = useQueryClient();
	return createMutation(() => ({
		mutationFn: (id: string) => itemsApi.deleteItem(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
			toast.success('Item deleted');
		},
		onError: (error: Error) => {
			toast.error(error.message || 'Failed to delete item');
		}
	}));
}
