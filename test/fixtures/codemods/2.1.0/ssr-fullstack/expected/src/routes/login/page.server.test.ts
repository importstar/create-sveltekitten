import { beforeEach, describe, expect, it, vi } from 'vitest';
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
