import type { Handle } from '@sveltejs/kit';
import { handleAuthGuard } from '$lib/hooks/auth-guard';

export const handle: Handle = handleAuthGuard;
