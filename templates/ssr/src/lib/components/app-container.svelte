<script lang="ts">
	let { children } = $props();
</script>

<div class="flex flex-1 flex-col gap-4 p-4">
	{@render children?.()}
</div>
