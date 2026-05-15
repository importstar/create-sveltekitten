<script lang="ts">
	import { useMe } from '$lib/features/me/queries';
	import UserProfile from '$lib/components/user-profile.svelte';

	const currentUserQuery = useMe();
</script>

{#if currentUserQuery.isLoading}
	<p>Loading user data...</p>
{:else if currentUserQuery.error}
	<p class="text-red-500">Error loading user data: {currentUserQuery.error.message}</p>
{:else}
	<UserProfile user={currentUserQuery.data} />
{/if}
