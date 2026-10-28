import type { Codemod } from './index.js';
import { createFile, replaceFile } from './helpers.js';

const OLD_REFRESH = `import type { Cookies } from '@sveltejs/kit';
import { logger } from '$lib/logger';
import { clearCookieTokens, setAuthTokens } from '$lib/utils/auth';

type TokenPair = { access_token: string; refresh_token?: string | null };

// A successful refresh stays shared for a short while after it settles: a request that read the
// old refresh token just before the rotation reuses the new pair instead of presenting a token
// the backend has already revoked.
const REUSE_MS = 10_000;
const refreshes = new Map<string, Promise<TokenPair | null>>();

function sharedRefresh(
	refreshToken: string,
	backendBase: string,
	fetchFn: typeof fetch
): Promise<TokenPair | null> {
	const existing = refreshes.get(refreshToken);
	if (existing) return existing;

	const pending = fetchFn(\`\${backendBase}/v1/auth/refresh\`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: \`Bearer \${refreshToken}\`
		}
	}).then(async (resp) => (resp.ok ? ((await resp.json()) as TokenPair) : null));

	refreshes.set(refreshToken, pending);
	pending.then(
		() => setTimeout(() => refreshes.delete(refreshToken), REUSE_MS),
		() => refreshes.delete(refreshToken)
	);
	return pending;
}

/**
 * Refreshes the caller's tokens through the backend and writes them to the caller's cookies.
 * Concurrent callers holding the same refresh token share one backend request.
 * Returns the new access token, or undefined after clearing the cookies when refresh is impossible.
 */
export async function refreshTokens(
	cookies: Cookies,
	backendBase: string,
	fetchFn: typeof fetch
): Promise<string | undefined> {
	const refreshToken = cookies.get('refresh_token');
	if (!refreshToken) {
		logger.warn('[API Proxy] No refresh token, clearing cookies');
		clearCookieTokens(cookies);
		return undefined;
	}

	const tokens = await sharedRefresh(refreshToken, backendBase, fetchFn);
	if (!tokens) {
		logger.warn('[API Proxy] Refresh token invalid/expired, clearing cookies');
		clearCookieTokens(cookies);
		return undefined;
	}

	setAuthTokens(cookies, tokens.access_token, tokens.refresh_token);
	return tokens.access_token;
}
`;

const NEW_REFRESH = `import type { Cookies } from '@sveltejs/kit';
import { logger } from '$lib/logger';
import { clearCookieTokens, setAuthTokens } from '$lib/utils/auth';

// GetAccessTokenResponse in fastapi.json has no refresh_token, so the caller's cookie is kept;
// a backend that does rotate it may still return one.
type TokenPair = { access_token: string; refresh_token?: string | null };

// A successful refresh stays shared for a short while after it settles: a request that read the
// old refresh token just before a rotation reuses the new tokens instead of presenting a token
// the backend has already revoked.
const REUSE_MS = 10_000;
const refreshes = new Map<string, Promise<TokenPair | null>>();

function sharedRefresh(
	refreshToken: string,
	backendBase: string,
	fetchFn: typeof fetch
): Promise<TokenPair | null> {
	const existing = refreshes.get(refreshToken);
	if (existing) return existing;

	// GET /v1/auth/refresh_token reads the token from the refresh_token cookie and also declares
	// HTTPBearer security (fastapi.json), so it gets both. This is the only backend request the
	// proxy sends a cookie on, and it is built here, never copied from the browser.
	const pending = fetchFn(\`\${backendBase}/v1/auth/refresh_token\`, {
		method: 'GET',
		headers: {
			Cookie: \`refresh_token=\${refreshToken}\`,
			Authorization: \`Bearer \${refreshToken}\`
		}
	}).then(async (resp) => (resp.ok ? ((await resp.json()) as TokenPair) : null));

	refreshes.set(refreshToken, pending);
	pending.then(
		() => setTimeout(() => refreshes.delete(refreshToken), REUSE_MS),
		() => refreshes.delete(refreshToken)
	);
	return pending;
}

/**
 * Refreshes the caller's tokens through the backend and writes them to the caller's cookies.
 * Concurrent callers holding the same refresh token share one backend request.
 * Returns the new access token, or undefined after clearing the cookies when refresh is impossible.
 */
export async function refreshTokens(
	cookies: Cookies,
	backendBase: string,
	fetchFn: typeof fetch
): Promise<string | undefined> {
	const refreshToken = cookies.get('refresh_token');
	if (!refreshToken) {
		logger.warn('[API Proxy] No refresh token, clearing cookies');
		clearCookieTokens(cookies);
		return undefined;
	}

	const tokens = await sharedRefresh(refreshToken, backendBase, fetchFn);
	if (!tokens) {
		logger.warn('[API Proxy] Refresh token invalid/expired, clearing cookies');
		clearCookieTokens(cookies);
		return undefined;
	}

	setAuthTokens(cookies, tokens.access_token, tokens.refresh_token);
	return tokens.access_token;
}
`;

const OLD_REFRESH_TEST = `import { describe, expect, it, vi } from 'vitest';
import type { Cookies } from '@sveltejs/kit';
import { refreshTokens } from './refresh';

const BACKEND = 'http://backend.test';

function cookieJar(initial: Record<string, string>) {
	const jar = new Map(Object.entries(initial));
	const cookies = {
		get: (name: string) => jar.get(name),
		set: (name: string, value: string) => void jar.set(name, value),
		delete: (name: string) => void jar.delete(name)
	} as unknown as Cookies;
	return { jar, cookies };
}

function backend(respond: (refreshToken: string) => Response | Promise<Response>) {
	return vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
		await new Promise((resolve) => setTimeout(resolve, 20));
		const auth = new Headers(init?.headers).get('authorization') ?? '';
		return respond(auth.replace('Bearer ', ''));
	});
}

const rotated = (n: number) => () =>
	Response.json({ access_token: \`access-\${n}\`, refresh_token: \`refresh-\${n}\` });

describe('refreshTokens', () => {
	it('sends one refresh for concurrent callers with the same refresh token', async () => {
		const fetchFn = backend(rotated(1));
		const callers = [1, 2, 3].map(() => cookieJar({ refresh_token: 'shared-1' }));

		const results = await Promise.all(
			callers.map(({ cookies }) => refreshTokens(cookies, BACKEND, fetchFn))
		);

		expect(fetchFn).toHaveBeenCalledTimes(1);
		expect(results).toEqual(['access-1', 'access-1', 'access-1']);
		for (const { jar } of callers) expect(jar.get('access_token')).toBe('access-1');
	});

	it('gives a caller that still holds the just-rotated token the new pair', async () => {
		const fetchFn = backend(rotated(2));
		await refreshTokens(cookieJar({ refresh_token: 'rotating-2' }).cookies, BACKEND, fetchFn);

		const late = cookieJar({ refresh_token: 'rotating-2' });
		expect(await refreshTokens(late.cookies, BACKEND, fetchFn)).toBe('access-2');
		expect(late.jar.get('refresh_token')).toBe('refresh-2');
		expect(fetchFn).toHaveBeenCalledTimes(1);
	});

	it('clears the cookies when the backend rejects the refresh token', async () => {
		const fetchFn = backend(() => new Response(null, { status: 401 }));
		const { jar, cookies } = cookieJar({ access_token: 'old', refresh_token: 'revoked-3' });

		expect(await refreshTokens(cookies, BACKEND, fetchFn)).toBeUndefined();
		expect(jar.has('access_token')).toBe(false);
		expect(jar.has('refresh_token')).toBe(false);
	});

	it('clears the cookies without calling the backend when there is no refresh token', async () => {
		const fetchFn = backend(rotated(4));
		const { jar, cookies } = cookieJar({ access_token: 'old' });

		expect(await refreshTokens(cookies, BACKEND, fetchFn)).toBeUndefined();
		expect(fetchFn).not.toHaveBeenCalled();
		expect(jar.has('access_token')).toBe(false);
	});

	it('retries after a network failure instead of reusing it', async () => {
		let calls = 0;
		const fetchFn = backend(() => {
			calls++;
			if (calls === 1) throw new TypeError('fetch failed');
			return rotated(5)();
		});

		await expect(
			refreshTokens(cookieJar({ refresh_token: 'flaky-5' }).cookies, BACKEND, fetchFn)
		).rejects.toThrow('fetch failed');
		expect(
			await refreshTokens(cookieJar({ refresh_token: 'flaky-5' }).cookies, BACKEND, fetchFn)
		).toBe('access-5');
	});
});
`;

const NEW_REFRESH_TEST = `import { describe, expect, it, vi } from 'vitest';
import type { Cookies } from '@sveltejs/kit';
import { refreshTokens } from './refresh';

const BACKEND = 'http://backend.test';

function cookieJar(initial: Record<string, string>) {
	const jar = new Map(Object.entries(initial));
	const cookies = {
		get: (name: string) => jar.get(name),
		set: (name: string, value: string) => void jar.set(name, value),
		delete: (name: string) => void jar.delete(name)
	} as unknown as Cookies;
	return { jar, cookies };
}

// Answers like GET /v1/auth/refresh_token in fastapi.json: the refresh token comes from the
// refresh_token cookie; anything else is a 404.
function backend(respond: (refreshToken: string) => Response | Promise<Response>) {
	return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
		await new Promise((resolve) => setTimeout(resolve, 20));
		if (String(url) !== \`\${BACKEND}/v1/auth/refresh_token\` || (init?.method ?? 'GET') !== 'GET') {
			return new Response(null, { status: 404 });
		}
		const cookie = new Headers(init?.headers).get('cookie') ?? '';
		return respond(/(?:^|;\\s*)refresh_token=([^;]*)/.exec(cookie)?.[1] ?? '');
	});
}

const accessOnly = (n: number) => () =>
	Response.json({ access_token: \`access-\${n}\`, token_type: 'bearer' });
const rotated = (n: number) => () =>
	Response.json({
		access_token: \`access-\${n}\`,
		refresh_token: \`refresh-\${n}\`,
		token_type: 'bearer'
	});

describe('refreshTokens', () => {
	it('sends the refresh token as cookie and bearer to GET /v1/auth/refresh_token', async () => {
		const fetchFn = backend(accessOnly(0));
		await refreshTokens(cookieJar({ refresh_token: 'spec-0' }).cookies, BACKEND, fetchFn);

		const [url, init] = fetchFn.mock.calls[0];
		const headers = new Headers(init?.headers);
		expect(url).toBe(\`\${BACKEND}/v1/auth/refresh_token\`);
		expect(init?.method).toBe('GET');
		expect(headers.get('cookie')).toBe('refresh_token=spec-0');
		expect(headers.get('authorization')).toBe('Bearer spec-0');
	});

	it('keeps the refresh token cookie when the backend returns only an access token', async () => {
		const fetchFn = backend((token) =>
			token === 'kept-6' ? accessOnly(6)() : new Response(null, { status: 401 })
		);
		const { jar, cookies } = cookieJar({ access_token: 'old', refresh_token: 'kept-6' });

		expect(await refreshTokens(cookies, BACKEND, fetchFn)).toBe('access-6');
		expect(jar.get('access_token')).toBe('access-6');
		expect(jar.get('refresh_token')).toBe('kept-6');
	});

	it('sends one refresh for concurrent callers with the same refresh token', async () => {
		const fetchFn = backend(accessOnly(1));
		const callers = [1, 2, 3].map(() => cookieJar({ refresh_token: 'shared-1' }));

		const results = await Promise.all(
			callers.map(({ cookies }) => refreshTokens(cookies, BACKEND, fetchFn))
		);

		expect(fetchFn).toHaveBeenCalledTimes(1);
		expect(results).toEqual(['access-1', 'access-1', 'access-1']);
		for (const { jar } of callers) expect(jar.get('access_token')).toBe('access-1');
	});

	it('gives a caller that still holds a just-rotated token the new tokens', async () => {
		const fetchFn = backend(rotated(2));
		await refreshTokens(cookieJar({ refresh_token: 'rotating-2' }).cookies, BACKEND, fetchFn);

		const late = cookieJar({ refresh_token: 'rotating-2' });
		expect(await refreshTokens(late.cookies, BACKEND, fetchFn)).toBe('access-2');
		expect(late.jar.get('refresh_token')).toBe('refresh-2');
		expect(fetchFn).toHaveBeenCalledTimes(1);
	});

	it('clears the cookies when the backend rejects the refresh token', async () => {
		const fetchFn = backend(() => new Response(null, { status: 401 }));
		const { jar, cookies } = cookieJar({ access_token: 'old', refresh_token: 'revoked-3' });

		expect(await refreshTokens(cookies, BACKEND, fetchFn)).toBeUndefined();
		expect(jar.has('access_token')).toBe(false);
		expect(jar.has('refresh_token')).toBe(false);
	});

	it('clears the cookies without calling the backend when there is no refresh token', async () => {
		const fetchFn = backend(accessOnly(4));
		const { jar, cookies } = cookieJar({ access_token: 'old' });

		expect(await refreshTokens(cookies, BACKEND, fetchFn)).toBeUndefined();
		expect(fetchFn).not.toHaveBeenCalled();
		expect(jar.has('access_token')).toBe(false);
	});

	it('retries after a network failure instead of reusing it', async () => {
		let calls = 0;
		const fetchFn = backend(() => {
			calls++;
			if (calls === 1) throw new TypeError('fetch failed');
			return accessOnly(5)();
		});

		await expect(
			refreshTokens(cookieJar({ refresh_token: 'flaky-5' }).cookies, BACKEND, fetchFn)
		).rejects.toThrow('fetch failed');
		expect(
			await refreshTokens(cookieJar({ refresh_token: 'flaky-5' }).cookies, BACKEND, fetchFn)
		).toBe('access-5');
	});
});
`;

const OLD_MOCK_API = `import { createServer } from 'node:http';

// Valid JWTs with exp: 9999999999 (year 2286) — jwt.decode() parses without verification
const MOCK_ACCESS_TOKEN =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.fake';
const MOCK_REFRESH_TOKEN =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.fake';

const VALID = { username: 'admin', password: 'secret' };

const server = createServer(async (req, res) => {
	const chunks = [];
	for await (const chunk of req) chunks.push(chunk);
	const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');

	res.setHeader('Content-Type', 'application/json');

	if (req.method === 'POST' && req.url === '/v1/auth/login') {
		if (body.username === VALID.username && body.password === VALID.password) {
			res.writeHead(200);
			res.end(
				JSON.stringify({
					access_token: MOCK_ACCESS_TOKEN,
					refresh_token: MOCK_REFRESH_TOKEN,
					token_type: 'bearer',
				})
			);
		} else {
			res.writeHead(401);
			res.end(JSON.stringify({ detail: 'Invalid credentials' }));
		}
		return;
	}

	if (req.method === 'POST' && req.url === '/v1/auth/refresh') {
		res.writeHead(200);
		res.end(
			JSON.stringify({
				access_token: MOCK_ACCESS_TOKEN,
				refresh_token: MOCK_REFRESH_TOKEN,
				token_type: 'bearer',
			})
		);
		return;
	}

	if (req.method === 'GET' && req.url === '/v1/health') {
		res.writeHead(200);
		res.end(JSON.stringify({ status: 'ok' }));
		return;
	}

	res.writeHead(404);
	res.end(JSON.stringify({ detail: 'Not found' }));
});

server.listen(9001, () => console.log('Mock API running on http://localhost:9001'));
`;

const NEW_MOCK_API = `import { createServer } from 'node:http';

// Valid JWTs with exp: 9999999999 (year 2286) — jwt.decode() parses without verification
const MOCK_ACCESS_TOKEN =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.fake';
const MOCK_REFRESH_TOKEN =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.fake-refresh';

const VALID = { username: 'admin', password: 'secret' };

const server = createServer(async (req, res) => {
	const chunks = [];
	for await (const chunk of req) chunks.push(chunk);
	const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');

	res.setHeader('Content-Type', 'application/json');

	if (req.method === 'POST' && req.url === '/v1/auth/login') {
		if (body.username === VALID.username && body.password === VALID.password) {
			res.writeHead(200);
			res.end(
				JSON.stringify({
					access_token: MOCK_ACCESS_TOKEN,
					refresh_token: MOCK_REFRESH_TOKEN,
					token_type: 'bearer',
				})
			);
		} else {
			res.writeHead(401);
			res.end(JSON.stringify({ detail: 'Invalid credentials' }));
		}
		return;
	}

	// As in src/libs/api-specs/fastapi.json: the refresh token arrives as the refresh_token cookie
	// and only a new access token (GetAccessTokenResponse) comes back.
	if (req.method === 'GET' && req.url === '/v1/auth/refresh_token') {
		const refreshToken = /(?:^|;\\s*)refresh_token=([^;]*)/.exec(req.headers.cookie ?? '')?.[1];
		if (refreshToken === MOCK_REFRESH_TOKEN) {
			res.writeHead(200);
			res.end(JSON.stringify({ access_token: MOCK_ACCESS_TOKEN, token_type: 'bearer' }));
		} else {
			res.writeHead(401);
			res.end(JSON.stringify({ detail: 'Invalid refresh token' }));
		}
		return;
	}

	if (req.method === 'GET' && req.url === '/v1/users/me') {
		if (req.headers.authorization === \`Bearer \${MOCK_ACCESS_TOKEN}\`) {
			res.writeHead(200);
			res.end(JSON.stringify({ username: VALID.username }));
		} else {
			res.writeHead(401);
			res.end(JSON.stringify({ detail: 'Not authenticated' }));
		}
		return;
	}

	if (req.method === 'GET' && req.url === '/v1/health') {
		res.writeHead(200);
		res.end(JSON.stringify({ status: 'ok' }));
		return;
	}

	res.writeHead(404);
	res.end(JSON.stringify({ detail: 'Not found' }));
});

server.listen(9001, () => console.log('Mock API running on http://localhost:9001'));
`;

const PROXY_REFRESH_E2E = `import { readFileSync } from 'node:fs';
import { test, expect, type APIResponse } from '@playwright/test';

// The refresh token e2e/mock-api.js accepts; any other access token than its own gets a 401.
const REFRESH_TOKEN =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.fake-refresh';
const EXPIRED_ACCESS_TOKEN = 'expired-access-token';

// Only FastAPI mode runs e2e/mock-api.js; full-stack mode has no backend behind the proxy.
const { ssrMode } = JSON.parse(readFileSync('.sveltekitten.json', 'utf-8')) as { ssrMode?: string };

const setCookie = (response: APIResponse, name: string) =>
	response
		.headersArray()
		.filter((h) => h.name.toLowerCase() === 'set-cookie')
		.map((h) => h.value)
		.find((value) => value.startsWith(\`\${name}=\`));

test.describe('API proxy token refresh', () => {
	test.skip(ssrMode !== 'fastapi', 'needs the FastAPI mock backend');

	test('refreshes an expired access token and keeps the refresh token', async ({ request }) => {
		const response = await request.get('/api/proxy/v1/users/me', {
			headers: { cookie: \`access_token=\${EXPIRED_ACCESS_TOKEN}; refresh_token=\${REFRESH_TOKEN}\` }
		});

		expect(response.status()).toBe(200);
		expect(await response.json()).toEqual({ username: 'admin' });
		expect(setCookie(response, 'access_token')).toMatch(
			/^access_token=(?!expired-access-token)[^;]+;/
		);
		expect(setCookie(response, 'refresh_token')).toBeUndefined();
	});

	test('clears the cookies when the refresh token is rejected', async ({ request }) => {
		const response = await request.get('/api/proxy/v1/users/me', {
			headers: { cookie: \`access_token=\${EXPIRED_ACCESS_TOKEN}; refresh_token=\${REFRESH_TOKEN}x\` }
		});

		expect(response.status()).toBe(401);
		expect(setCookie(response, 'access_token')).toMatch(/^access_token=;/);
		expect(setCookie(response, 'refresh_token')).toMatch(/^refresh_token=;/);
	});
});
`;

// The proxy route and refresh.ts are shared by both SSR modes, as in 0.3.23. The e2e test skips
// itself outside FastAPI mode.
const codemod: Codemod = {
	from: '0.3.23',
	to: '0.3.24',
	transforms: [
		{
			file: 'src/lib/server/proxy/refresh.ts',
			template: 'ssr',
			transform: replaceFile(OLD_REFRESH, NEW_REFRESH),
		},
		{
			file: 'src/lib/server/proxy/refresh.test.ts',
			template: 'ssr',
			transform: replaceFile(OLD_REFRESH_TEST, NEW_REFRESH_TEST),
		},
		{
			file: 'e2e/mock-api.js',
			template: 'ssr',
			transform: replaceFile(OLD_MOCK_API, NEW_MOCK_API),
		},
		{
			file: 'e2e/proxy-refresh.test.ts',
			create: true,
			template: 'ssr',
			transform: createFile(PROXY_REFRESH_E2E),
		},
	],
};

export default codemod;
