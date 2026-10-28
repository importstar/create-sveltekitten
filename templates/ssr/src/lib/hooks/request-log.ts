import { isSpanContextValid } from '@opentelemetry/api';
import { isHttpError, isRedirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import type { Logger } from 'pino';
import { logger } from '#lib/server/logger.js';

/**
 * One `info` line per request: method, route id (never the URL, whose query may carry secrets),
 * status and duration, with the trace/span ids of SvelteKit's `sveltekit.handle.root` span. Put it
 * first in `sequence(...)` so the duration covers the other hooks.
 */
export function createRequestLog(log: Logger = logger, now = () => performance.now()): Handle {
	// Named, so its span is `sveltekit.handle.sequenced.handleRequestLog`.
	return async function handleRequestLog({ event, resolve }) {
		const start = now();
		let status = 500;
		try {
			const response = await resolve(event);
			status = response.status;
			return response;
		} catch (err) {
			// A hook later in the sequence threw; SvelteKit turns this into the response.
			if (isRedirect(err) || isHttpError(err)) status = err.status;
			throw err;
		} finally {
			const root = event.tracing.root.spanContext();
			const traced = isSpanContextValid(root);
			log.info(
				{
					method: event.request.method,
					route: event.route.id,
					status,
					duration_ms: Math.round(now() - start),
					...(traced && { trace_id: root.traceId, span_id: root.spanId })
				},
				'request'
			);
		}
	};
}

export const handleRequestLog: Handle = createRequestLog();
