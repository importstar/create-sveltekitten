<script>
	import Button from '$lib/components/ui/button/button.svelte';
	import { Card, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';

	import { useHealthStatus } from '$lib/features/health/queries';
	import LogoutButton from '$lib/features/login/components/logout-button.svelte';
	import { authStore } from '$lib/stores/auth.svelte';

	const healthQuery = useHealthStatus();
</script>

<div class="container mx-auto p-6">
	<h1 class="mb-6 text-3xl font-bold">API Server Status</h1>
	<div class="mb-6">
		{#if authStore.isAuthenticated}
			<Button href="/me" variant="secondary">
				Logged in as: {authStore.user?.username}
			</Button>
			<LogoutButton />
		{:else}
			<Button href="/login">Login</Button>
		{/if}
	</div>
	<div>
		<Card class="max-w-md">
			<CardHeader>
				<div class="flex items-center gap-2">
					<CardTitle>FastAPI Service</CardTitle>
					{#if healthQuery.isLoading}
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500"
						></div>
					{:else if healthQuery.isError}
						<div class="h-4 w-4 rounded-full bg-red-500"></div>
					{:else if healthQuery.data}
						<div class="h-4 w-4 rounded-full bg-green-500"></div>
					{/if}
				</div>
				<CardDescription>Real-time service health indicator</CardDescription>
			</CardHeader>
		</Card>
	</div>
</div>
