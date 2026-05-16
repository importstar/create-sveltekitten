<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { Card, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import * as api from '$lib/features/health/api';
	import { healthKeys, useHealthStatus } from '$lib/features/health/queries';

	let { data } = $props();

	// Pattern 1: SSR prefetch → TQ takes over client-side.
	// Server load pre-fetches; initialData seeds the cache immediately (no loading flash).
	// Use when SEO matters or first-paint data is critical.
	const ssrHealthQuery = createQuery(() => ({
		queryKey: [...healthKeys.all, 'ssr'],
		queryFn: () => api.healthStatus(),
		initialData: data.health ?? undefined,
		staleTime: 1000 * 60,
		refetchInterval: 1000 * 60
	}));

	// Pattern 2: Client-only TQ.
	// Server does no work; fetch happens entirely on the client after hydration.
	// Use for user-specific data or when reducing server load matters.
	const clientHealthQuery = useHealthStatus();
</script>

<div class="container mx-auto p-6">
	<h1 class="mb-6 text-3xl font-bold">Home</h1>
	<div class="grid gap-4 sm:grid-cols-2">
		<Card>
			<CardHeader>
				<div class="flex items-center gap-2">
					<CardTitle>SSR + TQ</CardTitle>
					{#if ssrHealthQuery.isLoading}
						<div class="h-3 w-3 animate-pulse rounded-full bg-gray-300"></div>
					{:else if ssrHealthQuery.isError}
						<div class="h-3 w-3 rounded-full bg-red-500"></div>
					{:else if ssrHealthQuery.data}
						<div class="h-3 w-3 rounded-full bg-green-500"></div>
					{/if}
				</div>
				<CardDescription>Server prefetch → TQ hydration. No loading flash, SEO-friendly.</CardDescription>
			</CardHeader>
		</Card>

		<Card>
			<CardHeader>
				<div class="flex items-center gap-2">
					<CardTitle>Client-only TQ</CardTitle>
					{#if clientHealthQuery.isLoading}
						<div class="h-3 w-3 animate-pulse rounded-full bg-gray-300"></div>
					{:else if clientHealthQuery.isError}
						<div class="h-3 w-3 rounded-full bg-red-500"></div>
					{:else if clientHealthQuery.data}
						<div class="h-3 w-3 rounded-full bg-green-500"></div>
					{/if}
				</div>
				<CardDescription
					>Fetches after hydration. Reduces server load, ideal for user-specific data.</CardDescription
				>
			</CardHeader>
		</Card>
	</div>
</div>
