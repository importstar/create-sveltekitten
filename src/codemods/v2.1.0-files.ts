// Whole files for the 2.1.0 codemod (v2.1.0.ts), copied from the templates. Regenerate rather than
// edit by hand when a template file changes before release.

/** src/instrumentation.server.ts */
export const INSTRUMENTATION = `// Runs before the rest of the server (SvelteKit loads it first; \`tracing.server\` in
// vite.config.ts turns on SvelteKit's spans). Spans always get real trace/span ids, so log lines
// and \`errorId\` correlate even without a backend; they are only exported when
// OTEL_EXPORTER_OTLP_ENDPOINT is set. Without it nothing is sent anywhere.
import { context, propagation, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import { OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_SERVICE_NAME } from '$app/env/private';

const endpoint = OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\\/$/, '');

const provider = new TracerProvider({
	resource: resourceFromAttributes({ 'service.name': OTEL_SERVICE_NAME }),
	spanProcessors: endpoint
		? [
				new BatchSpanProcessor({
					exporter: new OTLPTraceExporter({ url: \`\${endpoint}/v1/traces\` })
				})
			]
		: []
});

// The context manager makes the span SvelteKit starts for a request the active one in the code it
// runs (\`trace.getActiveSpan()\`, which the logger reads). The propagator continues a trace from an
// incoming \`traceparent\` header.
context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
propagation.setGlobalPropagator(new W3CTraceContextPropagator());
trace.setGlobalTracerProvider(provider);

// Send the spans still buffered before the process exits.
process.once('sveltekit:shutdown', () => void provider.shutdown());
`;

/** src/lib/server/logger.ts */
export const LOGGER = `import { isSpanContextValid, trace } from '@opentelemetry/api';
import pino, { type DestinationStream, type Logger } from 'pino';
import { dev } from '$app/env';
import { LOG_LEVEL } from '$app/env/private';

/**
 * Keys whose values never reach a log line, at the top level and one level down (\`{ user: {
 * password } }\`). Redaction only sees object fields: never interpolate a value into the message.
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

/** \`destination\` is for tests: it replaces stdout (and the pretty printer in dev). */
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

/** Server-only (this file is under \`src/lib/server/\`): importing it from browser code fails the build. */
export const logger = createLogger();
`;

/** src/lib/server/logger.test.ts */
export const LOGGER_TEST = `import { describe, expect, it } from 'vitest';
import { captureLogs, inSpan } from './testing/logs.js';

describe('logger', () => {
	it('redacts credentials, tokens and cookies at every level', () => {
		const { logger, raw, lines } = captureLogs();
		const secrets = {
			password: 'pw-secret',
			token: 'token-secret',
			access_token: 'access-secret',
			refresh_token: 'refresh-secret',
			cookie: 'cookie-secret',
			'set-cookie': 'set-cookie-secret',
			user: { password: 'nested-pw', token: 'nested-token' },
			req: { headers: { cookie: 'h-cookie', authorization: 'Bearer h-auth' } },
			res: { headers: { 'set-cookie': 'h-set-cookie' } }
		};
		for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const) {
			logger[level](secrets, 'with secrets');
		}

		expect(lines).toHaveLength(6);
		const output = raw.join('');
		for (const value of [
			'pw-secret',
			'token-secret',
			'access-secret',
			'refresh-secret',
			'cookie-secret',
			'nested-pw',
			'nested-token',
			'h-cookie',
			'h-auth',
			'h-set-cookie'
		]) {
			expect(output).not.toContain(value);
		}
		expect(lines[0].password).toBe('[Redacted]');
	});

	it('adds trace_id and span_id of the active span to every line', async () => {
		const { logger, lines } = captureLogs();
		const ids = await inSpan('work', async (span) => {
			logger.info('inside');
			return span.spanContext();
		});
		logger.info('outside');

		expect(lines[0]).toMatchObject({ trace_id: ids.traceId, span_id: ids.spanId });
		expect(lines[0].trace_id).toMatch(/^[0-9a-f]{32}$/);
		expect(lines[1]).not.toHaveProperty('trace_id');
	});
});
`;

/** src/lib/server/testing/logs.ts */
export const TESTING_LOGS = `import { context, trace, type Span } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { TracerProvider } from '@opentelemetry/sdk-trace';
import { createLogger } from '../logger.js';

export type LogLine = Record<string, unknown> & { level: number; msg: string };

/** A logger at \`trace\` level that keeps every line: \`raw\` as written, \`lines\` parsed. */
export function captureLogs() {
	const raw: string[] = [];
	const lines: LogLine[] = [];
	const logger = createLogger({
		write(line: string) {
			raw.push(line);
			lines.push(JSON.parse(line));
		}
	});
	logger.level = 'trace';
	return { logger, raw, lines };
}

let registered = false;

/**
 * Runs \`fn\` inside an active span with real ids, as SvelteKit does for \`sveltekit.handle.root\`
 * once src/instrumentation.server.ts has registered the SDK. Nothing is exported.
 */
export async function inSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
	if (!registered) {
		context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
		trace.setGlobalTracerProvider(new TracerProvider());
		registered = true;
	}
	return trace.getTracer('test').startActiveSpan(name, async (span) => {
		try {
			return await fn(span);
		} finally {
			span.end();
		}
	});
}
`;

/** src/lib/hooks/request-log.ts */
export const REQUEST_LOG = `import { isSpanContextValid } from '@opentelemetry/api';
import { isHttpError, isRedirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import type { Logger } from 'pino';
import { logger } from '#lib/server/logger.js';

/**
 * One \`info\` line per request: method, route id (never the URL, whose query may carry secrets),
 * status and duration, with the trace/span ids of SvelteKit's \`sveltekit.handle.root\` span. Put it
 * first in \`sequence(...)\` so the duration covers the other hooks.
 */
export function createRequestLog(log: Logger = logger, now = () => performance.now()): Handle {
	// Named, so its span is \`sveltekit.handle.sequenced.handleRequestLog\`.
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
`;

/** src/lib/hooks/request-log.test.ts */
export const REQUEST_LOG_TEST = `import { describe, expect, it } from 'vitest';
import { trace, type Span } from '@opentelemetry/api';
import { redirect, type RequestEvent } from '@sveltejs/kit';
import { createRequestLog } from './request-log.js';
import { captureLogs, inSpan } from '#lib/server/testing/logs.js';

function eventFor(root: Span, url: string, routeId: string | null): RequestEvent {
	return {
		request: new Request(url),
		url: new URL(url),
		route: { id: routeId },
		tracing: { enabled: true, root, current: root }
	} as unknown as RequestEvent;
}

// Advances 40ms per call: the handle reads it once before and once after resolve.
const clock = () => {
	let t = 0;
	return () => (t += 40);
};

describe('handleRequestLog', () => {
	it('logs one line with route id, status, duration and the root span ids', async () => {
		const { logger, lines, raw } = captureLogs();
		const handle = createRequestLog(logger, clock());

		const root = await inSpan('sveltekit.handle.root', async (span) => {
			await handle({
				event: eventFor(span, 'http://localhost/items/42?token=query-secret', '/(protected)/items'),
				resolve: async () => {
					logger.debug('inside the request');
					return new Response('ok', { status: 201 });
				}
			});
			return span.spanContext();
		});

		const requestLines = lines.filter((line) => line.msg === 'request');
		expect(requestLines).toHaveLength(1);
		expect(requestLines[0]).toMatchObject({
			level: 30,
			method: 'GET',
			route: '/(protected)/items',
			status: 201,
			duration_ms: 40,
			trace_id: root.traceId,
			span_id: root.spanId
		});
		// Lines logged while handling the request carry the same trace id.
		expect(lines.find((line) => line.msg === 'inside the request')?.trace_id).toBe(root.traceId);
		// The route id, never the URL with its query.
		expect(raw.join('')).not.toContain('query-secret');
	});

	it('logs the status of a redirect thrown by a later hook', async () => {
		const { logger, lines } = captureLogs();
		const handle = createRequestLog(logger, clock());

		await inSpan('sveltekit.handle.root', async (span) => {
			await expect(
				handle({
					event: eventFor(span, 'http://localhost/home', '/(protected)/home'),
					resolve: async () => redirect(303, '/login')
				})
			).rejects.toMatchObject({ status: 303 });
		});

		expect(lines.filter((line) => line.msg === 'request')).toMatchObject([{ status: 303 }]);
	});

	it('leaves out trace ids when tracing is off', async () => {
		const { logger, lines } = captureLogs();
		const handle = createRequestLog(logger, clock());
		const noop = trace.wrapSpanContext({
			traceId: '0'.repeat(32),
			spanId: '0'.repeat(16),
			traceFlags: 0
		});

		await handle({
			event: eventFor(noop, 'http://localhost/nope', null),
			resolve: async () => new Response(null, { status: 404 })
		});

		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatchObject({ route: null, status: 404 });
		expect(lines[0]).not.toHaveProperty('trace_id');
	});
});
`;

/** src/lib/hooks/handle-error.ts */
export const HANDLE_ERROR = `import { isSpanContextValid, trace } from '@opentelemetry/api';
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
 * \`+server\`, hooks) to \`handleError\`. Errors thrown with \`error(...)\` and SvelteKit's own (404s)
 * are expected and not logged. Every error the client sees gets an \`errorId\`: the trace id, so a
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
`;

/** src/lib/hooks/handle-error.test.ts */
export const HANDLE_ERROR_TEST = `import { describe, expect, it } from 'vitest';
import { trace, type Span } from '@opentelemetry/api';
import type { RequestEvent } from '@sveltejs/kit';
import type { HandleServerError } from '@sveltejs/kit/hooks';
import { createHandleError } from './handle-error.js';
import { captureLogs, inSpan } from '#lib/server/testing/logs.js';

type Input = Parameters<HandleServerError>[0];

function eventFor(root: Span): RequestEvent {
	return {
		request: new Request('http://localhost/api/items', { method: 'POST' }),
		route: { id: '/api/items' },
		tracing: { enabled: true, root, current: root }
	} as unknown as RequestEvent;
}

describe('handleError', () => {
	it('logs an unexpected error once, with stack and trace id, and returns the trace id as errorId', async () => {
		const { logger, lines } = captureLogs();
		const handleError = createHandleError(logger);

		const { result, traceId } = await inSpan('sveltekit.handle.root', async (span) => ({
			result: await handleError({
				kind: 'unknown',
				error: new Error('database exploded'),
				event: eventFor(span)
			} as Input),
			traceId: span.spanContext().traceId
		}));

		expect(result).toEqual({ errorId: traceId });
		const errors = lines.filter((line) => line.level === 50);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({
			trace_id: traceId,
			error_id: traceId,
			route: '/api/items',
			method: 'POST',
			err: { message: 'database exploded' }
		});
		expect((errors[0].err as { stack: string }).stack).toContain('database exploded');
	});

	it('gives expected errors an errorId without logging them', async () => {
		const { logger, lines } = captureLogs();
		const handleError = createHandleError(logger);

		const result = await inSpan('sveltekit.handle.root', async (span) =>
			handleError({
				kind: 'framework',
				error: { status: 404, message: 'Not Found' },
				event: eventFor(span)
			} as Input)
		);

		expect(result).toEqual({ errorId: expect.stringMatching(/^[0-9a-f]{32}$/) });
		expect(lines).toEqual([]);
	});

	it('falls back to a random errorId when tracing is not running', () => {
		const { logger, lines } = captureLogs();
		const noop = trace.wrapSpanContext({
			traceId: '0'.repeat(32),
			spanId: '0'.repeat(16),
			traceFlags: 0
		});

		const result = createHandleError(logger)({
			kind: 'unknown',
			error: new Error('boom'),
			event: eventFor(noop)
		} as Input) as { errorId: string };

		expect(result.errorId).toMatch(/^[0-9a-f-]{36}$/);
		expect(lines[0]).toMatchObject({ level: 50, error_id: result.errorId });
	});
});
`;

/** src/routes/login/page.server.test.ts (full-stack) */
export const LOGIN_TEST_FULLSTACK = `import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { actions } from './+page.server';
import { authenticate } from '#lib/server/auth/users.js';

// Every log line the login action writes, at every level.
const sink = vi.hoisted(() => ({ raw: [] as string[] }));
vi.mock('#lib/server/logger.js', async (importOriginal) => {
	const real = await importOriginal<typeof import('#lib/server/logger.js')>();
	const logger = real.createLogger({ write: (line: string) => void sink.raw.push(line) });
	logger.level = 'trace';
	return { ...real, logger };
});
vi.mock('#lib/server/db/index.js', () => ({ db: {} }));
vi.mock('#lib/server/auth/users.js', () => ({ authenticate: vi.fn() }));
vi.mock('#lib/server/auth/session.js', () => ({
	generateSessionToken: () => 'session-token-secret',
	createSession: async () => ({ expiresAt: new Date(Date.now() + 60_000) }),
	setSessionCookie: (cookies: Cookies, token: string) =>
		cookies.set('session_id', token, { path: '/' })
}));

const PASSWORD = 'correct-horse-battery-staple';
const SECRETS = [PASSWORD, 'session-token-secret'];

async function login() {
	const body = new FormData();
	body.set('username', 'admin');
	body.set('password', PASSWORD);
	const cookies = { set: vi.fn(), get: vi.fn(), delete: vi.fn() } as unknown as Cookies;
	const event = {
		request: new Request('http://localhost/login', { method: 'POST', body }),
		cookies
	} as unknown as RequestEvent;
	return Promise.resolve()
		.then(() => actions.default!(event as never))
		.catch((thrown: unknown) => thrown);
}

function expectNoSecretsLogged() {
	const output = sink.raw.join('');
	for (const secret of SECRETS) expect(output).not.toContain(secret);
}

describe('login logging', () => {
	beforeEach(() => {
		sink.raw.length = 0;
	});

	it('success: logs the outcome, never the password or session token', async () => {
		vi.mocked(authenticate).mockResolvedValue({ id: 'user-1', username: 'admin' } as never);
		expect(await login()).toMatchObject({ status: 303, location: '/home' });
		expect(sink.raw.join('')).toContain('login succeeded');
		expectNoSecretsLogged();
	});

	it('wrong password: logs the outcome, never the password', async () => {
		vi.mocked(authenticate).mockResolvedValue(null);
		expect(await login()).toMatchObject({ status: 400 });
		expect(sink.raw.join('')).toContain('login rejected');
		expectNoSecretsLogged();
	});

	it('authentication error: logs the error, never the password', async () => {
		vi.mocked(authenticate).mockRejectedValue(new Error('SQLITE_BUSY: database is locked'));
		expect(await login()).toMatchObject({ status: 500 });
		expect(sink.raw.join('')).toContain('SQLITE_BUSY');
		expectNoSecretsLogged();
	});
});
`;

/** src/routes/login/page.server.test.ts (FastAPI) */
export const LOGIN_TEST_FASTAPI = `import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { actions } from './+page.server';

// Every log line the login action writes, at every level.
const sink = vi.hoisted(() => ({ raw: [] as string[] }));
vi.mock('#lib/server/logger.js', async (importOriginal) => {
	const real = await importOriginal<typeof import('#lib/server/logger.js')>();
	const logger = real.createLogger({ write: (line: string) => void sink.raw.push(line) });
	logger.level = 'trace';
	return { ...real, logger };
});

const PASSWORD = 'correct-horse-battery-staple';
const ACCESS = 'access-token-secret';
const REFRESH = 'refresh-token-secret';
const SECRETS = [PASSWORD, ACCESS, REFRESH];

async function login(post: () => Promise<unknown>) {
	const body = new FormData();
	body.set('username', 'admin');
	body.set('password', PASSWORD);
	const event = {
		request: new Request('http://localhost/login', { method: 'POST', body }),
		cookies: { set: vi.fn(), get: vi.fn(), delete: vi.fn() } as unknown as Cookies,
		locals: { fastapiClient: { POST: vi.fn(post) } }
	} as unknown as RequestEvent;
	return Promise.resolve()
		.then(() => actions.default!(event as never))
		.catch((thrown: unknown) => thrown);
}

function expectNoSecretsLogged() {
	const output = sink.raw.join('');
	for (const secret of SECRETS) expect(output).not.toContain(secret);
}

describe('login logging', () => {
	beforeEach(() => {
		sink.raw.length = 0;
	});

	it('success: logs the outcome, never the password or tokens', async () => {
		const result = await login(async () => ({
			data: { access_token: ACCESS, refresh_token: REFRESH, token_type: 'bearer' },
			response: new Response(null, { status: 200 })
		}));
		expect(result).toMatchObject({ status: 303, location: '/home' });
		expect(sink.raw.join('')).toContain('login succeeded');
		expectNoSecretsLogged();
	});

	it('wrong password: logs the outcome, never the password', async () => {
		const result = await login(async () => ({
			error: { detail: 'Incorrect username or password' },
			response: new Response(null, { status: 401 })
		}));
		expect(result).toMatchObject({ status: 400 });
		expect(sink.raw.join('')).toContain('login rejected');
		expectNoSecretsLogged();
	});

	it('FastAPI down: logs the error, never the password', async () => {
		const result = await login(async () => {
			throw new TypeError('fetch failed', {
				cause: new Error('connect ECONNREFUSED 127.0.0.1:9000')
			});
		});
		expect(result).toMatchObject({ status: 502 });
		expect(sink.raw.join('')).toContain('fetch failed');
		expectNoSecretsLogged();
	});
});
`;

/** src/hooks.server.ts (full-stack) */
export const HOOKS_FULLSTACK = `import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { handleAuthGuard } from '#lib/hooks/auth-guard.js';
import { handleRequestLog } from '#lib/hooks/request-log.js';

export { handleError } from '#lib/hooks/handle-error.js';

export const handle: Handle = sequence(handleRequestLog, handleAuthGuard);
`;

/** src/hooks.server.ts (FastAPI) */
export const HOOKS_FASTAPI = `import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { handleFastApiClient } from '#lib/hooks/fastapi.hook.js';
import { handleAuthGuard } from '#lib/hooks/auth-guard.js';
import { handleRequestLog } from '#lib/hooks/request-log.js';

export { handleError } from '#lib/hooks/handle-error.js';

export const handle: Handle = sequence(handleRequestLog, handleAuthGuard, handleFastApiClient);
`;

/** src/lib/logger.ts as 2.0.0 had it */
export const OLD_LOGGER = `import { dev } from '$app/env';
import pino from 'pino';

// Create different logger configurations for server and browser
const createLogger = () => {
	return pino({
		level: dev ? 'debug' : 'info',
		redact: [
			'password',
			'*.password',
			'cookie',
			'*.cookie',
			'authorization',
			'*.authorization',
			'req.headers.cookie',
			'req.headers.authorization'
		],
		transport: dev
			? {
					target: 'pino-pretty',
					options: {
						colorize: true,
						translateTime: 'SYS:yyyy-mm-dd HH:MM:ss'
					}
				}
			: undefined
	});
};

const baseLogger = createLogger();

export const logger = Object.assign(baseLogger, {
	inspect: (...args: unknown[]) => {
		if (dev) {
			console.log(...args);
		}
	},
	dir: (obj: unknown, options?: Parameters<typeof console.dir>[1]) => {
		if (dev) {
			console.dir(obj, options);
		}
	},
	table: (data: unknown, columns?: string[]) => {
		if (dev) {
			console.table(data, columns);
		}
	}
});
`;

/** src/hooks.server.ts as 2.0.0 had it (full-stack) */
export const OLD_HOOKS_FULLSTACK = `import type { Handle } from '@sveltejs/kit/hooks';
import { handleAuthGuard } from '#lib/hooks/auth-guard.js';

export const handle: Handle = handleAuthGuard;
`;

/** src/hooks.server.ts as 2.0.0 had it (FastAPI) */
export const OLD_HOOKS_FASTAPI = `import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { handleFastApiClient } from '#lib/hooks/fastapi.hook.js';
import { handleAuthGuard } from '#lib/hooks/auth-guard.js';

export const handle: Handle = sequence(handleAuthGuard, handleFastApiClient);
`;
