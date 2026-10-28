import { describe, expect, it } from 'vitest';
import { createDb } from '../db/client';
import { users } from '../db/schema';
import { authenticate, createUser, UsernameTakenError } from './users';

function setup() {
	const db = createDb(':memory:');
	const countUsers = () => db.select().from(users).all().length;
	return { db, countUsers };
}

describe('authenticate', () => {
	it('returns null for an unknown username without creating a user', async () => {
		const { db, countUsers } = setup();
		await createUser(db, 'alice', 'correct-horse');

		expect(await authenticate(db, 'mallory', 'whatever-pw')).toBeNull();
		expect(countUsers()).toBe(1);
	});

	it('returns null for a wrong password', async () => {
		const { db } = setup();
		await createUser(db, 'alice', 'correct-horse');

		expect(await authenticate(db, 'alice', 'wrong-horse')).toBeNull();
	});

	it('returns the user without a password hash for the right password', async () => {
		const { db } = setup();
		const created = await createUser(db, 'alice', 'correct-horse');

		const user = await authenticate(db, 'alice', 'correct-horse');

		expect(user).toEqual({ id: created.id, username: 'alice', createdAt: expect.any(Date) });
		expect(user).not.toHaveProperty('passwordHash');
	});
});

describe('createUser', () => {
	it('rejects a taken username and writes nothing', async () => {
		const { db, countUsers } = setup();
		await createUser(db, 'alice', 'correct-horse');

		await expect(createUser(db, 'alice', 'another-pw')).rejects.toBeInstanceOf(UsernameTakenError);
		expect(countUsers()).toBe(1);
		expect(await authenticate(db, 'alice', 'correct-horse')).not.toBeNull();
	});
});
