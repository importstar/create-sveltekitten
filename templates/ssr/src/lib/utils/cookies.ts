import { dev } from '$app/environment';

export interface CookieOptions {
	path?: string;
	maxAge?: number;
	secure?: boolean;
	httpOnly?: boolean;
	sameSite?: 'strict' | 'lax' | 'none';
	domain?: string;
}

export function createCookieOptions(options: CookieOptions = {}) {
	return {
		path: options?.path ?? '/',
		maxAge: options?.maxAge ?? 60 * 30, // 30 นาที (วินาที)
		secure: options?.secure ?? !dev,
		httpOnly: options?.httpOnly ?? true,
		// SameSite: 'lax' is a good default for most cases
		sameSite: options?.sameSite ?? 'lax',
		domain: options?.domain ?? undefined
	};
}
