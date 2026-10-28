import { describe, expect, it, vi } from 'vitest';
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
	Response.json({ access_token: `access-${n}`, refresh_token: `refresh-${n}` });

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
