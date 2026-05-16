<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { authStore } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';
	import client from '$lib/api/client';
	import { toast } from 'svelte-sonner';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	async function logout() {
		authStore.logout();
		await client.POST('/v1/auth/logout', { credentials: 'include' });
		toast.success('Logged out successfully');
		await goto('/login');
	}
</script>

<div class="flex min-h-svh flex-col">
	<header class="flex items-center justify-between border-b px-6 py-3">
		<a href="/home" class="font-semibold">App</a>
		<div class="flex items-center gap-4">
			<span class="text-muted-foreground text-sm">{authStore.user?.username}</span>
			<Separator orientation="vertical" class="h-4" />
			<Button variant="outline" size="sm" onclick={logout}>Logout</Button>
		</div>
	</header>

	<main class="flex-1">
		{@render children()}
	</main>
</div>
