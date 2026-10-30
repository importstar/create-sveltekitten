import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { handleApiClient } from '#lib/hooks/api-client.hook.js';
import { handleAuthGuard } from '#lib/hooks/auth-guard.js';
import { handleRequestLog } from '#lib/hooks/request-log.js';

export { handleError } from '#lib/hooks/handle-error.js';

export const handle: Handle = sequence(handleRequestLog, handleAuthGuard, handleApiClient);
