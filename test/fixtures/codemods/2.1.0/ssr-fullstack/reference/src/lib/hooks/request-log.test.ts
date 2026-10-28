import { describe, expect, it } from 'vitest';
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
