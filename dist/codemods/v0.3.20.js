import { normalizeNewlines, PATTERN_NOT_FOUND_WARNING, replaceFile, warn } from './helpers.js';
const OLD_AUTH_GUARD = `import { clearCookieTokens, isProtectedRoute, isTokenExpired } from '$lib/utils/auth';
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
const NEW_AUTH_GUARD = `import { isProtectedRoute } from '$lib/utils/auth';
import { validateSessionToken, setSessionCookie, deleteSessionCookie } from '$lib/server/auth/session';
import type { Handle } from '@sveltejs/kit';

export const handleAuthGuard: Handle = async ({ event, resolve }) => {
	const { cookies, route } = event;

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

	if (isProtectedRoute(route.id) && !event.locals.user) {
		return new Response(null, {
			status: 303,
			headers: { location: '/login' }
		});
	}

	const response = await resolve(event);
	return response;
};
`;
const OLD_PROTECTED_LAYOUT = `import jwt from 'jsonwebtoken';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, locals }) => {
	if (locals.user) {
		return { user: { username: locals.user.username } };
	}
	const accessToken = cookies.get('access_token');
	const payload = accessToken
		? (jwt.decode(accessToken) as { sub?: string } | null)
		: null;
	return { user: { username: payload?.sub ?? 'User' } };
};
`;
const NEW_PROTECTED_LAYOUT = `import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	return { user: { username: locals.user.username } };
};
`;
const OLD_LOGIN_IMPORT = "import { setAuthTokens, isTokenExpired } from '$lib/utils/auth';";
const NEW_LOGIN_IMPORT = "import { setAuthTokens } from '$lib/utils/auth';";
const OLD_LOGIN_LOAD = `export const load = (async ({ cookies, locals }) => {
	if (locals.user) {
		throw redirect(303, '/home');
	}
	const refreshToken = cookies.get('refresh_token');
	if (refreshToken && !isTokenExpired(refreshToken)) {
		throw redirect(303, '/home');
	}
`;
const NEW_LOGIN_LOAD = `export const load = (async ({ locals }) => {
	if (locals.user) {
		throw redirect(303, '/home');
	}
`;
const replaceAuthGuard = replaceFile(OLD_AUTH_GUARD, NEW_AUTH_GUARD);
const UNSAFE_CHECK = 'event.locals.user || (refreshToken && !isTokenExpired(refreshToken))';
// An edited guard still gets the one-line fix when the unsafe check is intact.
function fixAuthGuard(content) {
    const replaced = replaceAuthGuard(content);
    if (typeof replaced === 'string')
        return replaced;
    if (content.includes(UNSAFE_CHECK))
        return content.replace(UNSAFE_CHECK, 'event.locals.user');
    return replaced;
}
function fixLogin(content) {
    if (content.includes(OLD_LOGIN_LOAD) && content.includes(OLD_LOGIN_IMPORT)) {
        return content.replace(OLD_LOGIN_LOAD, NEW_LOGIN_LOAD).replace(OLD_LOGIN_IMPORT, NEW_LOGIN_IMPORT);
    }
    const normalized = normalizeNewlines(content);
    if (normalized.includes(NEW_LOGIN_LOAD) && normalized.includes(NEW_LOGIN_IMPORT))
        return content;
    return warn(content, PATTERN_NOT_FOUND_WARNING);
}
const codemod = {
    from: '0.3.19',
    to: '0.3.20',
    transforms: [
        {
            file: 'src/lib/hooks/auth-guard.ts',
            template: 'ssr',
            ssrMode: 'fullstack',
            transform: fixAuthGuard,
        },
        {
            file: 'src/routes/(protected)/+layout.server.ts',
            template: 'ssr',
            ssrMode: 'fullstack',
            transform: replaceFile(OLD_PROTECTED_LAYOUT, NEW_PROTECTED_LAYOUT),
        },
        {
            file: 'src/routes/login/+page.server.ts',
            template: 'ssr',
            ssrMode: 'fullstack',
            transform: fixLogin,
        },
    ],
};
export default codemod;
