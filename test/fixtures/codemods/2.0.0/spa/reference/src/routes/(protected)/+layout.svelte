<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { authStore } from '#lib/stores/auth.svelte.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import client from '#lib/api/client.js';
	import { toast } from 'svelte-sonner';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	async function logout() {
		authStore.logout();
		await client.POST('/v1/auth/logout', { credentials: 'include' });
		toast.success('Logged out successfully');
		await goto(resolve('login'));
	}
</script>

<div class="flex min-h-svh flex-col">
	<header class="flex items-center justify-between border-b px-6 py-3">
		<div class="flex items-center gap-6">
			<a href={resolve('home')} class="text-lg font-bold tracking-tight text-primary"
				>SvelteKitten</a
			>
			<nav class="flex items-center gap-1 text-sm font-medium">
				<a
					href={resolve('home')}
					class="rounded-md px-3 py-1.5 transition-colors {page.url.pathname === '/home'
						? 'bg-muted text-foreground'
						: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
				>
					Home
				</a>
				<a
					href={resolve('items')}
					class="rounded-md px-3 py-1.5 transition-colors {page.url.pathname.startsWith('/items')
						? 'bg-muted text-foreground'
						: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
				>
					Items
				</a>
			</nav>
		</div>

		<div class="flex items-center gap-4">
			<span class="text-sm text-muted-foreground">{authStore.user?.username}</span>
			<Separator orientation="vertical" class="h-4" />
			<Button variant="outline" size="sm" onclick={logout}>Logout</Button>
		</div>
	</header>

	<main class="flex-1">
		{@render children()}
	</main>
</div>
