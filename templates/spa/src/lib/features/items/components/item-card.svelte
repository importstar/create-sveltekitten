<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Button } from '$lib/components/ui/button';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import type { Item } from '../schema';
	import { useToggleItem, useDeleteItem } from '../queries';

	interface Props {
		item: Item;
	}

	let { item }: Props = $props();

	const toggleMutation = useToggleItem();
	const deleteMutation = useDeleteItem();

	function handleToggle(checked: boolean | 'indeterminate') {
		if (typeof checked === 'boolean') {
			toggleMutation.mutate({ id: item.id, completed: checked });
		}
	}

	function handleDelete() {
		deleteMutation.mutate(item.id);
	}

	const isPending = $derived(toggleMutation.isPending || deleteMutation.isPending);
</script>

<div
	class="flex items-start justify-between gap-3 rounded-lg border p-4 transition-colors {item.completed
		? 'border-muted bg-muted/40'
		: 'bg-card hover:border-primary/40'}"
>
	<div class="flex items-start gap-3 pt-0.5">
		<Checkbox
			checked={item.completed}
			onCheckedChange={handleToggle}
			disabled={isPending}
			id="item-{item.id}"
		/>
		<div class="space-y-1">
			<label
				for="item-{item.id}"
				class="cursor-pointer text-sm leading-none font-medium {item.completed
					? 'text-muted-foreground line-through'
					: 'text-foreground'}"
			>
				{item.title}
			</label>
			{#if item.description}
				<p class="text-xs text-muted-foreground {item.completed ? 'line-through' : ''}">
					{item.description}
				</p>
			{/if}
			<p class="text-[10px] text-muted-foreground/70">
				{new Date(item.createdAt).toLocaleDateString(undefined, {
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				})}
			</p>
		</div>
	</div>

	<Button
		variant="ghost"
		size="icon"
		class="size-8 shrink-0 text-muted-foreground hover:text-destructive"
		onclick={handleDelete}
		disabled={isPending}
		aria-label="Delete item"
	>
		{#if deleteMutation.isPending}
			<LoaderCircle class="h-4 w-4 animate-spin" />
		{:else}
			<Trash2Icon class="h-4 w-4" />
		{/if}
	</Button>
</div>
