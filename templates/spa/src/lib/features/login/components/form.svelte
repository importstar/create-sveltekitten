<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Form from '$lib/components/ui/form/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { defaults, superForm } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import { loginSchema } from '../schema';
	import { toast } from 'svelte-sonner';
	import client from '$lib/api/client';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.svelte';

	// Helper functions
	function extractErrorMessage(error: any): string {
		if (typeof error === 'object' && error !== null) {
			if ('message' in error && typeof error.message === 'string') {
				return error.message;
			}
			if ('detail' in error && typeof error.detail === 'string') {
				return error.detail;
			}
			if ('errors' in error && Array.isArray(error.errors) && error.errors[0]?.msg) {
				return error.errors[0].msg;
			}
		}
		return 'Invalid credentials or server error';
	}

	function createFormError(form: any, message: string) {
		return {
			form: {
				...form,
				valid: false,
				errors: { username: [message] }
			}
		};
	}

	async function handleLoginSuccess(loginData: any, meData: any) {
		authStore.login(loginData, {
			username: meData.username,
			name: meData.name,
			id: meData.id,
			role: meData.role,
			is_active: meData.is_active,
			email: meData.email,
			last_login_date: meData.last_login_date,
			created_at: meData.created_at
		});
		await goto('/').catch(console.error);
	}

	const form = superForm(defaults(zod4(loginSchema)), {
		SPA: true,
		validators: zod4(loginSchema),
		resetForm: false,
		onUpdate: async ({ form }) => {
			if (!form.valid) {
				toast.error('Form not valid. Please check the fields.');
				return;
			}

			// Use toast.promise for the entire login process
			try {
				await toast.promise(
					(async () => {
						console.log('Form is valid:', form.data);

						// Login request
						const { data: loginData, error: loginError } = await client.POST('/v1/auth/login', {
							body: { ...form.data, platform: 'web' }
						});
						console.log('Login response:', { data: loginData, error: loginError });

						if (loginError) {
							console.error('Login error details:', loginError);
							const message = extractErrorMessage(loginError);
							throw new Error(message);
						}

						if (!loginData) {
							throw new Error('No login data received');
						}

						reset();

						// Get user profile
						const { data: meData } = await client.GET('/v1/users/me', {
							headers: { Authorization: `Bearer ${loginData.access_token}` }
						});
						console.log('Me response:', { me: meData });

						if (!meData) {
							throw new Error('Failed to retrieve user data');
						}

						await handleLoginSuccess(loginData, meData);
						return 'Login successful!';
					})(),
					{
						loading: 'Logging in...',
						success: (message) => message,
						error: (err) => {
							console.error('Login error:', err);
							return err instanceof Error ? err.message : 'Login failed';
						}
					}
				);
			} catch (err) {
				// Handle form error after toast.promise
				const message = err instanceof Error ? err.message : 'Login failed';
				return createFormError(form, message);
			}
		}
	});
	const { form: formData, submitting, reset } = form;
</script>

<Card.Root class="mx-auto w-full max-w-sm">
	<Card.Header>
		<Card.Title class="text-2xl">Login</Card.Title>
		<Card.Description>Enter your email below to login to your account</Card.Description>
	</Card.Header>
	<Card.Content>
		<form method="POST" use:form.enhance>
			<Field.FieldGroup>
				<Form.Field {form} name="username">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Username</Form.Label>
							<Input {...props} bind:value={$formData.username} />
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
				<Form.Field {form} name="password">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Password</Form.Label>
							<Input
								{...props}
								type="password"
								bind:value={$formData.password}
								placeholder="Enter your password"
							/>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
				<Form.Button disabled={$submitting}>Login</Form.Button>
			</Field.FieldGroup>
		</form>
	</Card.Content>
</Card.Root>
