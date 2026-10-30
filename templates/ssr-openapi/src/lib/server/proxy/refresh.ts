import type { Cookies } from '@sveltejs/kit';
import { logger } from '#lib/server/logger.js';
import { clearCookieTokens, setAuthTokens } from '#lib/utils/auth.js';

// GetAccessTokenResponse in openapi.json has no refresh_token, so the caller's cookie is kept;
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
	// HTTPBearer security (openapi.json), so it gets both. This is the only backend request the
	// proxy sends a cookie on, and it is built here, never copied from the browser.
	const pending = fetchFn(`${backendBase}/v1/auth/refresh_token`, {
		method: 'GET',
		headers: {
			Cookie: `refresh_token=${refreshToken}`,
			Authorization: `Bearer ${refreshToken}`
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
