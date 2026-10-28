import { createHash, randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { sessions, users } from '#lib/server/db/schema.js';
import { createUser } from './users';
import {
	createSession,
	generateSessionToken,
	hashSessionToken,
	invalidateSession,
	validateSessionToken
} from './session';

vi.mock('#lib/server/db/index.js', async () => {
	const { createDb } = await import('#lib/server/db/client.js');
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
