import type { Handle } from '@sveltejs/kit/hooks';
import { handleAuthGuard } from '#lib/hooks/auth-guard.js';

export const handle: Handle = handleAuthGuard;
