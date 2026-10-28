import type { Codemod } from './index.js';
import { createFile, replaceFile } from './helpers.js';

// 1.1.2: the sessions table stores sha256(token) instead of the raw cookie token, so a leaked
// database cannot be replayed as session cookies. session.ts is swapped only while it is still
// exactly the 1.1.1 template; session.test.ts is new.

const OLD_SESSION = `import { db } from '$lib/server/db';
import { sessions, users, type User, type Session } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'session_id';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function generateSessionToken(): string {
	return randomBytes(32).toString('hex');
}

export async function createSession(token: string, userId: string): Promise<Session> {
	const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
	const [session] = await db
		.insert(sessions)
		.values({
			id: token,
			userId,
			expiresAt
		})
		.returning();
	return session;
}

export async function validateSessionToken(
	token: string
): Promise<{ session: Session; user: User } | { session: null; user: null }> {
	try {
		const result = await db
			.select({
				session: sessions,
				user: {
					id: users.id,
					username: users.username,
					createdAt: users.createdAt
				}
			})
			.from(sessions)
			.innerJoin(users, eq(sessions.userId, users.id))
			.where(eq(sessions.id, token))
			.get();

		if (!result) {
			return { session: null, user: null };
		}

		const { session, user } = result;

		// Check expiration
		if (Date.now() >= session.expiresAt.getTime()) {
			await db.delete(sessions).where(eq(sessions.id, session.id));
			return { session: null, user: null };
		}

		// Extend session if within 3 days of expiring
		if (Date.now() >= session.expiresAt.getTime() - 1000 * 60 * 60 * 24 * 3) {
			session.expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
			await db
				.update(sessions)
				.set({ expiresAt: session.expiresAt })
				.where(eq(sessions.id, session.id));
		}

		return { session, user: user as User };
	} catch {
		return { session: null, user: null };
	}
}

export async function invalidateSession(sessionId: string): Promise<void> {
	try {
		await db.delete(sessions).where(eq(sessions.id, sessionId));
	} catch {
		// ignore
	}
}

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date) {
	cookies.set(SESSION_COOKIE_NAME, token, {
		httpOnly: true,
		path: '/',
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		expires: expiresAt
	});
}

export function deleteSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE_NAME, {
		httpOnly: true,
		path: '/',
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production'
	});
}
`;

const NEW_SESSION = `import { db } from '$lib/server/db';
import { sessions, users, type User, type Session } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';
import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'session_id';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function generateSessionToken(): string {
	return randomBytes(32).toString('hex');
}

/**
 * The sessions table stores this hash, never the token, so a leaked database cannot be
 * replayed as session cookies. Every function below takes the raw token from the cookie.
 */
export function hashSessionToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export async function createSession(token: string, userId: string): Promise<Session> {
	const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
	const [session] = await db
		.insert(sessions)
		.values({
			id: hashSessionToken(token),
			userId,
			expiresAt
		})
		.returning();
	return session;
}

export async function validateSessionToken(
	token: string
): Promise<{ session: Session; user: User } | { session: null; user: null }> {
	try {
		const result = await db
			.select({
				session: sessions,
				user: {
					id: users.id,
					username: users.username,
					createdAt: users.createdAt
				}
			})
			.from(sessions)
			.innerJoin(users, eq(sessions.userId, users.id))
			.where(eq(sessions.id, hashSessionToken(token)))
			.get();

		if (!result) {
			return { session: null, user: null };
		}

		const { session, user } = result;

		// Check expiration
		if (Date.now() >= session.expiresAt.getTime()) {
			await db.delete(sessions).where(eq(sessions.id, session.id));
			return { session: null, user: null };
		}

		// Extend session if within 3 days of expiring
		if (Date.now() >= session.expiresAt.getTime() - 1000 * 60 * 60 * 24 * 3) {
			session.expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
			await db
				.update(sessions)
				.set({ expiresAt: session.expiresAt })
				.where(eq(sessions.id, session.id));
		}

		return { session, user: user as User };
	} catch {
		return { session: null, user: null };
	}
}

export async function invalidateSession(token: string): Promise<void> {
	try {
		await db.delete(sessions).where(eq(sessions.id, hashSessionToken(token)));
	} catch {
		// ignore
	}
}

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date) {
	cookies.set(SESSION_COOKIE_NAME, token, {
		httpOnly: true,
		path: '/',
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		expires: expiresAt
	});
}

export function deleteSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE_NAME, {
		httpOnly: true,
		path: '/',
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production'
	});
}
`;

const SESSION_TEST = `import { createHash, randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import { sessions, users } from '$lib/server/db/schema';
import { createUser } from './users';
import {
	createSession,
	generateSessionToken,
	hashSessionToken,
	invalidateSession,
	validateSessionToken
} from './session';

vi.mock('$lib/server/db', async () => {
	const { createDb } = await import('$lib/server/db/client');
	return { db: createDb(':memory:') };
});

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

let userId: string;
beforeEach(async () => {
	db.delete(users).run();
	userId = (await createUser(db, 'alice', 'correct-horse')).id;
});

describe('session tokens', () => {
	it('stores sha256(token) as the session id, never the token', async () => {
		const token = generateSessionToken();
		await createSession(token, userId);

		const ids = db
			.select({ id: sessions.id })
			.from(sessions)
			.all()
			.map((row) => row.id);
		expect(ids).toEqual([sha256(token)]);
		expect(ids).not.toContain(token);
		expect(hashSessionToken(token)).toBe(sha256(token));
	});

	it('validates the raw token from the cookie', async () => {
		const token = generateSessionToken();
		await createSession(token, userId);

		const { session, user } = await validateSessionToken(token);

		expect(session?.id).toBe(sha256(token));
		expect(user).toEqual({ id: userId, username: 'alice', createdAt: expect.any(Date) });
	});

	it('rejects a session stored unhashed, as before sessions were hashed', async () => {
		const token = randomBytes(32).toString('hex');
		db.insert(sessions)
			.values({ id: token, userId, expiresAt: new Date(Date.now() + 60_000) })
			.run();

		await expect(validateSessionToken(token)).resolves.toEqual({ session: null, user: null });
	});

	it('invalidates the session for the raw token', async () => {
		const token = generateSessionToken();
		await createSession(token, userId);

		await invalidateSession(token);

		expect(db.select().from(sessions).all()).toEqual([]);
		expect((await validateSessionToken(token)).session).toBeNull();
	});
});
`;

const codemod: Codemod = {
	from: '1.1.1',
	to: '1.1.2',
	transforms: [
		{
			file: 'src/lib/server/auth/session.ts',
			template: 'ssr',
			ssrMode: 'fullstack',
			transform: replaceFile(OLD_SESSION, NEW_SESSION),
		},
		{
			file: 'src/lib/server/auth/session.test.ts',
			template: 'ssr',
			ssrMode: 'fullstack',
			create: true,
			transform: createFile(SESSION_TEST),
		},
	],
};

export default codemod;
