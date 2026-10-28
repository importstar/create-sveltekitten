import { isSpanContextValid, trace } from '@opentelemetry/api';
import type { RequestEvent } from '@sveltejs/kit';
import type { HandleServerError } from '@sveltejs/kit/hooks';
import type { Logger } from 'pino';
import { logger } from '#lib/server/logger.js';

/** The request's trace id (also on every log line of the request), if tracing is running. */
function traceIdOf(event: RequestEvent): string | undefined {
	for (const span of [event.tracing.root, trace.getActiveSpan()]) {
		const context = span?.spanContext();
		if (context && isSpanContextValid(context)) return context.traceId;
	}
	return undefined;
}

/**
 * The one place an unexpected error is logged: SvelteKit 3 passes every error (load, actions,
 * `+server`, hooks) to `handleError`. Errors thrown with `error(...)` and SvelteKit's own (404s)
 * are expected and not logged. Every error the client sees gets an `errorId`: the trace id, so a
 * user's report leads straight to the log lines and spans of that request.
 */
export function createHandleError(log: Logger = logger): HandleServerError {
	return ({ kind, error, event }) => {
		const errorId = traceIdOf(event) ?? crypto.randomUUID();
		if (kind === 'unknown') {
			log.error(
				{ err: error, route: event.route.id, method: event.request.method, error_id: errorId },
				'unexpected error'
			);
		}
		return { errorId };
	};
}

export const handleError: HandleServerError = createHandleError();
