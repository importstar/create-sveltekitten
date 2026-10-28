import { createFile, replaceFile } from './helpers.js';
const OLD_PROXY = `import { env } from '$env/dynamic/private';
import { logger } from '$lib/logger';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearCookieTokens, setAuthTokens } from '$lib/utils/auth';

const handler: RequestHandler = async ({ request, cookies, params, fetch, url }) => {
	if (!env.BACKEND_API_URL) {
		logger.error('BACKEND_API_URL environment variable is not set.');
		throw new Error('BACKEND_API_URL environment variable is not set.');
	}

	const path = params.slug;
	const accessToken = cookies.get('access_token');
	const backendBase = env.BACKEND_API_URL.replace(/\\/$/, '');
	const API_ENDPOINT = \`\${backendBase}/\${path}\${url.search}\`;

	logger.debug(\`\${params.slug}\`);
	logger.info(\`[API Proxy] Forwarding request to: [\${request.method}] \${API_ENDPOINT}\`);

	// Clean up response headers that may cause client-side decoding errors
	const createProxyResponse = (originalResponse: Response): Response => {
		const headers = new Headers(originalResponse.headers);
		headers.delete('content-encoding');
		headers.delete('content-length');
		return new Response(originalResponse.body, {
			status: originalResponse.status,
			statusText: originalResponse.statusText,
			headers
		});
	};

	// Normalize request headers before forwarding
	const sanitizeRequestHeaders = (h: Headers) => {
		h.delete('host');
		h.delete('content-length');
		// remove other hop-by-hop headers if present
		h.delete('connection');
		h.delete('keep-alive');
		h.delete('proxy-authorization');
		h.delete('transfer-encoding');
		// Optionally prevent backend from sending compressed responses
		h.delete('accept-encoding');
		return h;
	};

	const makeApiRequest = (token?: string) => {
		const headers = sanitizeRequestHeaders(new Headers(request.headers));
		if (token) {
			logger.debug('[API Proxy] Using access token to forward request');
			headers.set('authorization', \`Bearer \${token}\`);
		} else {
			headers.delete('authorization');
		}

		const fetchOptions: RequestInit & { duplex?: 'half' } = {
			method: request.method,
			headers
		};

		if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
			fetchOptions.duplex = 'half';
			fetchOptions.body = request.body;
		}

		return fetch(API_ENDPOINT, fetchOptions);
	};

	// Small helper to attempt refreshing the access token
	const tryRefresh = async (refreshToken?: string) => {
		if (!refreshToken) return undefined;
		const resp = await fetch(\`\${backendBase}/v1/auth/refresh\`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: \`Bearer \${refreshToken}\`
			}
		});

		if (!resp.ok) {
			logger.warn('[API Proxy] Refresh token invalid/expired, clearing cookies');
			clearCookieTokens(cookies);
			return undefined;
		}

		const data = await resp.json();
		setAuthTokens(cookies, data.access_token, data.refresh_token);
		return data.access_token as string | undefined;
	};

	try {
		let response = await makeApiRequest(accessToken);

		if (response.status === 401 && accessToken) {
			logger.warn(\`[API Proxy] Unauthorized request, trying to refresh access token.\`);
			const refreshToken = cookies.get('refresh_token');
			if (!refreshToken) {
				logger.warn(\`[API Proxy] No Refresh Token\`);
				clearCookieTokens(cookies);
				return createProxyResponse(response);
			}

			const newAccess = await tryRefresh(refreshToken);
			if (newAccess) {
				response = await makeApiRequest(newAccess);
			}
		}

		return createProxyResponse(response);
	} catch (err) {
		logger.error({ err }, \`[API Proxy] Error fetching from API: [\${request.method}] \${API_ENDPOINT}\`);
		throw error(502, \`Bad Gateway: Could not connect to API service. Please try again later.\`);
	}
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
`;
const NEW_PROXY = `import { env } from '$env/dynamic/private';
import { logger } from '$lib/logger';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { refreshTokens } from '$lib/server/proxy/refresh';

// Rejects slugs that could leave the backend base path once the URL is resolved, e.g.
// \`v1/../admin\` when BACKEND_API_URL carries a path prefix.
function isSafeProxyPath(slug: string): boolean {
	if (URL.canParse(slug) || slug.includes('\\\\')) return false;
	return !slug.split('/').some((segment) => segment === '..' || segment === '.');
}

// The global fetch, not event.fetch: SvelteKit's fetch attaches this app's cookies to requests for
// the same host or its subdomains (e.g. api.example.com), which would hand them to the backend.
const backendFetch: typeof fetch = (input, init) => fetch(input, init);

const handler: RequestHandler = async ({ request, cookies, params, url }) => {
	if (!env.BACKEND_API_URL) {
		logger.error('BACKEND_API_URL environment variable is not set.');
		throw new Error('BACKEND_API_URL environment variable is not set.');
	}

	const path = params.slug;
	if (!isSafeProxyPath(path)) {
		throw error(400, 'Invalid proxy path');
	}

	const accessToken = cookies.get('access_token');
	const backendBase = env.BACKEND_API_URL.replace(/\\/$/, '');
	const API_ENDPOINT = \`\${backendBase}/\${path}\${url.search}\`;

	logger.debug(\`\${params.slug}\`);
	logger.info(\`[API Proxy] Forwarding request to: [\${request.method}] \${API_ENDPOINT}\`);

	// Clean up response headers that may cause client-side decoding errors
	const createProxyResponse = (originalResponse: Response): Response => {
		const headers = new Headers(originalResponse.headers);
		headers.delete('content-encoding');
		headers.delete('content-length');
		return new Response(originalResponse.body, {
			status: originalResponse.status,
			statusText: originalResponse.statusText,
			headers
		});
	};

	// Normalize request headers before forwarding
	const sanitizeRequestHeaders = (h: Headers) => {
		h.delete('host');
		h.delete('content-length');
		// remove other hop-by-hop headers if present
		h.delete('connection');
		h.delete('keep-alive');
		h.delete('proxy-authorization');
		// The browser's cookies belong to this app (session, tokens), not to the backend
		h.delete('cookie');
		h.delete('transfer-encoding');
		// Optionally prevent backend from sending compressed responses
		h.delete('accept-encoding');
		return h;
	};

	// Buffered once so a retry after token refresh can send the same body again
	const body =
		request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();

	const makeApiRequest = (token?: string) => {
		const headers = sanitizeRequestHeaders(new Headers(request.headers));
		if (token) {
			logger.debug('[API Proxy] Using access token to forward request');
			headers.set('authorization', \`Bearer \${token}\`);
		} else {
			headers.delete('authorization');
		}

		return backendFetch(API_ENDPOINT, { method: request.method, headers, body });
	};

	try {
		let response = await makeApiRequest(accessToken);

		if (response.status === 401 && accessToken) {
			logger.warn(\`[API Proxy] Unauthorized request, trying to refresh access token.\`);
			const newAccess = await refreshTokens(cookies, backendBase, backendFetch);
			if (newAccess) {
				response = await makeApiRequest(newAccess);
			}
		}

		return createProxyResponse(response);
	} catch (err) {
		logger.error({ err }, \`[API Proxy] Error fetching from API: [\${request.method}] \${API_ENDPOINT}\`);
		throw error(502, \`Bad Gateway: Could not connect to API service. Please try again later.\`);
	}
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
`;
const OLD_BFF_AUTH_GUARD = `import { clearCookieTokens, isProtectedRoute, isTokenExpired } from '$lib/utils/auth';
import { validateSessionToken, setSessionCookie, deleteSessionCookie } from '$lib/server/auth/session';
import type { Handle } from '@sveltejs/kit';

export const handleAuthGuard: Handle = async ({ event, resolve }) => {
	const { cookies, route } = event;

	// 1. Check SQLite session token first
	const sessionId = cookies.get('session_id');
	if (sessionId) {
		const { session, user } = await validateSessionToken(sessionId);
		if (session && user) {
			event.locals.session = session;
			event.locals.user = user;
			setSessionCookie(cookies, sessionId, session.expiresAt);
		} else {
			deleteSessionCookie(cookies);
			event.locals.session = null;
			event.locals.user = null;
		}
	} else {
		event.locals.session = null;
		event.locals.user = null;
	}

	// 2. Check FastAPI refresh token
	const refreshToken = cookies.get('refresh_token');
	if (refreshToken && isTokenExpired(refreshToken)) {
		clearCookieTokens(cookies);
	}

	// 3. Route Guard for (protected) route group
	if (isProtectedRoute(route.id)) {
		const isAuthenticated = Boolean(
			event.locals.user || (refreshToken && !isTokenExpired(refreshToken))
		);

		if (!isAuthenticated) {
			return new Response(null, {
				status: 303,
				headers: { location: '/login' }
			});
		}
	}

	const response = await resolve(event);
	return response;
};
`;
const NEW_BFF_AUTH_GUARD = `import { clearCookieTokens, isProtectedRoute, isTokenExpired } from '$lib/utils/auth';
import { validateSessionToken, setSessionCookie, deleteSessionCookie } from '$lib/server/auth/session';
import type { Handle } from '@sveltejs/kit';

export const handleAuthGuard: Handle = async ({ event, resolve }) => {
	const { cookies, route } = event;

	// 1. Check SQLite session token first
	const sessionId = cookies.get('session_id');
	if (sessionId) {
		const { session, user } = await validateSessionToken(sessionId);
		if (session && user) {
			event.locals.session = session;
			event.locals.user = user;
			setSessionCookie(cookies, sessionId, session.expiresAt);
		} else {
			deleteSessionCookie(cookies);
			event.locals.session = null;
			event.locals.user = null;
		}
	} else {
		event.locals.session = null;
		event.locals.user = null;
	}

	// 2. Check FastAPI refresh token
	const refreshToken = cookies.get('refresh_token');
	if (refreshToken && isTokenExpired(refreshToken)) {
		clearCookieTokens(cookies);
	}

	// 3. Route Guard for (protected) route group. A UX guard only: the refresh token is decoded,
	// not verified, because this app holds no signing secret. FastAPI verifies the token on every
	// proxied request, so a forged cookie reaches page shells but no data.
	if (isProtectedRoute(route.id)) {
		const isAuthenticated = Boolean(
			event.locals.user || (refreshToken && !isTokenExpired(refreshToken))
		);

		if (!isAuthenticated) {
			return new Response(null, {
				status: 303,
				headers: { location: '/login' }
			});
		}
	}

	const response = await resolve(event);
	return response;
};
`;
const REFRESH = `import type { Cookies } from '@sveltejs/kit';
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
const REFRESH_TEST = `import { describe, expect, it, vi } from 'vitest';
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
const codemod = {
    from: '0.3.22',
    to: '0.3.23',
    transforms: [
        {
            file: 'src/routes/api/proxy/[...slug]/+server.ts',
            template: 'ssr',
            transform: replaceFile(OLD_PROXY, NEW_PROXY),
        },
        {
            file: 'src/lib/server/proxy/refresh.ts',
            create: true,
            template: 'ssr',
            transform: createFile(REFRESH),
        },
        {
            file: 'src/lib/server/proxy/refresh.test.ts',
            create: true,
            template: 'ssr',
            transform: createFile(REFRESH_TEST),
        },
        {
            file: 'src/lib/hooks/auth-guard.ts',
            template: 'ssr',
            ssrMode: 'fastapi',
            transform: replaceFile(OLD_BFF_AUTH_GUARD, NEW_BFF_AUTH_GUARD),
        },
    ],
};
export default codemod;
