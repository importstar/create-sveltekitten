import { describe, expect, it } from 'vitest';
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
