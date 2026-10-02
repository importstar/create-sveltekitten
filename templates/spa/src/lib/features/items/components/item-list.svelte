<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Button } from '$lib/components/ui/button';
	import type { Item } from '../schema';
	import { useItems } from '../queries';
	import ItemCard from './item-card.svelte';
	import ItemEmptyState from './item-empty-state.svelte';
	import { itemFilters, itemFilterKeys, type ItemFilterKey } from '../filters';
	import RotateCwIcon from '@lucide/svelte/icons/rotate-cw';

	interface Props {
		initialData?: Item[];
	}

	let { initialData }: Props = $props();

	const itemsQuery = useItems(() => initialData);

	let filter = $state<ItemFilterKey>('all');

	const items = $derived(itemsQuery.data ?? []);
	const counts = $derived(
		Object.fromEntries(
			itemFilterKeys.map((key) => [key, items.filter(itemFilters[key].predicate).length])
		) as Record<ItemFilterKey, number>
	);

	const filteredItems = $derived(items.filter(itemFilters[filter].predicate));
</script>

<div class="space-y-4">
	<!-- Filter header -->
	<div class="flex items-center justify-between gap-2">
		<div class="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 text-xs">
			{#each itemFilterKeys as key (key)}
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
		</div>

		<Button
			variant="ghost"
			size="icon"
			class="size-8 text-muted-foreground hover:text-foreground"
			onclick={() => itemsQuery.refetch()}
			disabled={itemsQuery.isFetching}
			aria-label="Refresh items"
		>
			<RotateCwIcon class="h-3.5 w-3.5 {itemsQuery.isFetching ? 'animate-spin' : ''}" />
		</Button>
	</div>

	<!-- Query States -->
	{#if itemsQuery.isLoading}
		<div class="space-y-2">
			<Skeleton class="h-16 w-full rounded-lg" />
			<Skeleton class="h-16 w-full rounded-lg" />
			<Skeleton class="h-16 w-full rounded-lg" />
		</div>
	{:else if itemsQuery.isError}
		<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
			<p class="text-sm text-destructive font-medium">Failed to load items</p>
			<p class="text-xs text-muted-foreground mt-1">{itemsQuery.error?.message}</p>
			<Button
				variant="outline"
				size="sm"
				class="mt-3"
				onclick={() => itemsQuery.refetch()}
			>
				Try Again
			</Button>
		</div>
	{:else if filteredItems.length === 0}
		<ItemEmptyState {filter} />
	{:else}
		<div class="space-y-2">
			{#each filteredItems as item (item.id)}
				<ItemCard {item} />
			{/each}
		</div>
	{/if}
</div>
