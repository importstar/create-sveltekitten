import { beforeEach, describe, expect, it, vi } from 'vitest';
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
