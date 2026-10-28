import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
import * as api from './api';
import type { CreateItemInput, Item } from './schema';
import { toast } from 'svelte-sonner';

export const itemKeys = {
	all: ['items'] as const,
	lists: () => [...itemKeys.all, 'list'] as const,
	detail: (id: string) => [...itemKeys.all, 'detail', id] as const
};

export function useItems(initialDataGetter?: () => Item[] | undefined) {
	return createQuery(() => ({
		queryKey: itemKeys.lists(),
		queryFn: api.fetchItems,
		initialData: initialDataGetter ? initialDataGetter() : undefined,
		staleTime: 1000 * 60
	}));
}

export function useCreateItem() {
	const queryClient = useQueryClient();
	return createMutation(() => ({
		mutationFn: (input: CreateItemInput) => api.createItem(input),
		onSuccess: (newItem) => {
			queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
			toast.success(`Created "${newItem.title}"`);
		},
		onError: (error: Error) => {
			toast.error(error.message || 'Failed to create item');
		}
	}));
}

export function useToggleItem() {
	const queryClient = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
			api.toggleItem(id, completed),
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

export function useDeleteItem() {
	const queryClient = useQueryClient();
	return createMutation(() => ({
		mutationFn: (id: string) => api.deleteItem(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
			toast.success('Item deleted');
		},
		onError: (error: Error) => {
			toast.error(error.message || 'Failed to delete item');
		}
	}));
}
