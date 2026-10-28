import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { handleFastApiClient } from '#lib/hooks/fastapi.hook.js';
import { handleAuthGuard } from '#lib/hooks/auth-guard.js';

export const handle: Handle = sequence(handleAuthGuard, handleFastApiClient);
