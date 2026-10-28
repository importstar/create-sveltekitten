<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import { PUBLIC_APP_TITLE } from '$app/env/public';
	import { SvelteQueryDevtools } from '@tanstack/svelte-query-devtools';
	import { itemsApi } from '#lib/features/items/api.js';
	import { setItemsApi } from '#lib/features/items/context.js';
	import { healthApi } from '#lib/features/health/api.js';
	import { setHealthApi } from '#lib/features/health/context.js';

	let { children, data } = $props();

	// Provide each feature's API to the whole app. Swap in fakes here (or in a test
	// harness) to run the UI without a backend; hooks read these via context.
	setItemsApi(itemsApi);
	setHealthApi(healthApi);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>
		{PUBLIC_APP_TITLE}
	</title>
</svelte:head>

<Toaster position="top-right" richColors />

<QueryClientProvider client={data.queryClient}>
	{@render children?.()}
	<SvelteQueryDevtools />
</QueryClientProvider>
