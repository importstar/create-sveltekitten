import { BACKEND_API_URL } from '$app/env/private';
import { logger } from '#lib/logger.js';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { refreshTokens } from '#lib/server/proxy/refresh.js';

// Rejects slugs that could leave the backend base path once the URL is resolved, e.g.
// `v1/../admin` when BACKEND_API_URL carries a path prefix.
function isSafeProxyPath(slug: string): boolean {
	if (URL.canParse(slug) || slug.includes('\\')) return false;
	return !slug.split('/').some((segment) => segment === '..' || segment === '.');
}

// The global fetch, not event.fetch: SvelteKit's fetch attaches this app's cookies to requests for
// the same host or its subdomains (e.g. api.example.com), which would hand them to the backend.
const backendFetch: typeof fetch = (input, init) => fetch(input, init);

const handler: RequestHandler = async ({ request, cookies, params, url }) => {
	if (!BACKEND_API_URL) {
		logger.error('BACKEND_API_URL environment variable is not set.');
		throw new Error('BACKEND_API_URL environment variable is not set.');
	}

	const path = params.slug;
	if (!isSafeProxyPath(path)) {
		throw error(400, 'Invalid proxy path');
	}

	const accessToken = cookies.get('access_token');
	const backendBase = BACKEND_API_URL.replace(/\/$/, '');
	const API_ENDPOINT = `${backendBase}/${path}${url.search}`;

	logger.debug(`${params.slug}`);
	logger.info(`[API Proxy] Forwarding request to: [${request.method}] ${API_ENDPOINT}`);

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
			headers.set('authorization', `Bearer ${token}`);
		} else {
			headers.delete('authorization');
		}

		return backendFetch(API_ENDPOINT, { method: request.method, headers, body });
	};

	try {
		let response = await makeApiRequest(accessToken);

		if (response.status === 401 && accessToken) {
			logger.warn(`[API Proxy] Unauthorized request, trying to refresh access token.`);
			const newAccess = await refreshTokens(cookies, backendBase, backendFetch);
			if (newAccess) {
				response = await makeApiRequest(newAccess);
			}
		}

		return createProxyResponse(response);
	} catch (err) {
		logger.error(
			{ err },
			`[API Proxy] Error fetching from API: [${request.method}] ${API_ENDPOINT}`
		);
		throw error(502, `Bad Gateway: Could not connect to API service. Please try again later.`);
	}
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
