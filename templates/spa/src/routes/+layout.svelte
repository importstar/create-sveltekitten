<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { PUBLIC_APP_TITLE } from '$env/static/public';
	import { browser } from '$app/environment';
	import { SvelteQueryDevtools } from '@tanstack/svelte-query-devtools';

	let { children } = $props();

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				// ลบ enabled: browser ออก เพราะอาจทำให้ query ไม่ทำงาน
				staleTime: 60 * 1000, // 1 minute
				retry: 1
			}
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>
		{PUBLIC_APP_TITLE}
	</title>
</svelte:head>

<Toaster position="top-right" richColors />

<QueryClientProvider client={queryClient}>
	{@render children?.()}
	<SvelteQueryDevtools />
</QueryClientProvider>
