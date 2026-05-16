<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<div class="flex min-h-svh flex-col">
	<header class="flex items-center justify-between border-b px-6 py-3">
		<a href="/home" class="font-semibold">App</a>
		<div class="flex items-center gap-4">
			<span class="text-muted-foreground text-sm">{data.user.username}</span>
			<Separator orientation="vertical" class="h-4" />
			<form method="POST" action="/logout">
				<Button type="submit" variant="outline" size="sm">Logout</Button>
			</form>
		</div>
	</header>

	<main class="flex-1">
		{@render children()}
	</main>
</div>
