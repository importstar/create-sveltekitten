import { isSpanContextValid, trace } from '@opentelemetry/api';
import pino, { type DestinationStream, type Logger } from 'pino';
import { dev } from '$app/env';
import { LOG_LEVEL } from '$app/env/private';

/**
 * Keys whose values never reach a log line, at the top level and one level down (`{ user: {
 * password } }`). Redaction only sees object fields: never interpolate a value into the message.
 */
export const REDACT_PATHS = [
	'password',
	'*.password',
	'token',
	'*.token',
	'access_token',
	'*.access_token',
	'refresh_token',
	'*.refresh_token',
	'cookie',
	'*.cookie',
	'authorization',
	'*.authorization',
	'["set-cookie"]',
	'*["set-cookie"]',
	'*.headers.cookie',
	'*.headers.authorization',
	'*.headers["set-cookie"]'
];

/** The ids of the active OpenTelemetry span, so a log line can be found from its trace and back. */
export function traceFields(): { trace_id?: string; span_id?: string } {
	const context = trace.getActiveSpan()?.spanContext();
	if (!context || !isSpanContextValid(context)) return {};
	return { trace_id: context.traceId, span_id: context.spanId };
}

/** `destination` is for tests: it replaces stdout (and the pretty printer in dev). */
export function createLogger(destination?: DestinationStream): Logger {
	return pino(
		{
			level: LOG_LEVEL || (dev ? 'debug' : 'info'),
			redact: REDACT_PATHS,
			mixin: traceFields,
			transport:
				dev && !destination
					? {
							target: 'pino-pretty',
							options: {
								colorize: true,
								translateTime: 'SYS:yyyy-mm-dd HH:MM:ss'
							}
						}
					: undefined
		},
		destination
	);
}

/** Server-only (this file is under `src/lib/server/`): importing it from browser code fails the build. */
export const logger = createLogger();
