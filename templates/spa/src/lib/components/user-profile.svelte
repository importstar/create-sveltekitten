<script lang="ts">
	import {
		Card,
		CardHeader,
		CardTitle,
		CardContent,
		CardDescription
	} from '$lib/components/ui/card';
	import type { components } from '$lib/api/openapi';

	type User = components['schemas']['UserResponse'];

	interface Props {
		user?: User | null;
	}

	let { user }: Props = $props();
</script>

{#if user}
	<Card class="max-w-md">
		<CardHeader>
			<CardTitle>User Profile</CardTitle>
			<CardDescription>Current user information</CardDescription>
		</CardHeader>
		<CardContent class="space-y-2">
			<div>
				<strong>Username:</strong>
				{user.username}
			</div>
			<div>
				<strong>Name:</strong>
				{user.name}
			</div>
			{#if user.email}
				<div>
					<strong>Email:</strong>
					{user.email}
				</div>
			{/if}
			<div>
				<strong>Role:</strong>
				{user.role}
			</div>
			<div>
				<strong>Status:</strong>
				{user.is_active ? 'Active' : 'Inactive'}
			</div>
			{#if user.last_login_date}
				<div>
					<strong>Last Login:</strong>
					{new Date(user.last_login_date).toLocaleString()}
				</div>
			{/if}
			{#if user.created_at}
				<div>
					<strong>Created:</strong>
					{new Date(user.created_at).toLocaleString()}
				</div>
			{/if}
		</CardContent>
	</Card>
{:else}
	<p>No user data available</p>
{/if}
