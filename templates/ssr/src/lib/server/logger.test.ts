import { describe, expect, it } from 'vitest';
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
