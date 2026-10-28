<script lang="ts">
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import { itemFilters, type ItemFilterKey } from '../filters';

	interface Props {
		filter: ItemFilterKey;
	}

	let { filter }: Props = $props();

	const message = $derived(itemFilters[filter].empty);
</script>

<div
	class="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center"
>
	<InboxIcon class="mb-3 h-10 w-10 text-muted-foreground/50" />
	<p class="text-sm font-medium text-foreground">{message}</p>
	<p class="mt-1 text-xs text-muted-foreground">
		Use the form to create new tasks or toggle existing ones.
	</p>
</div>
