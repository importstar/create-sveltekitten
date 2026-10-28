import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users, type User } from '../db/schema';
import { hashPassword, verifyPassword } from './password';

export class UsernameTakenError extends Error {
	constructor(username: string) {
		super(`Username "${username}" is already taken.`);
		this.name = 'UsernameTakenError';
	}
}

// Verified against when the username is unknown, so a missing user costs the same scrypt
// as a wrong password and response time does not reveal which usernames exist.
const DUMMY_HASH = hashPassword(randomBytes(16).toString('hex'));

export async function createUser(db: Db, username: string, password: string): Promise<User> {
	const created = db
		.insert(users)
		.values({
			id: crypto.randomUUID(),
			username,
			passwordHash: hashPassword(password),
			createdAt: new Date()
		})
		.onConflictDoNothing({ target: users.username })
		.returning({ id: users.id, username: users.username, createdAt: users.createdAt })
		.get();

	if (!created) throw new UsernameTakenError(username);
	return created;
}

export async function authenticate(
	db: Db,
	username: string,
	password: string
): Promise<User | null> {
	const user = db.select().from(users).where(eq(users.username, username)).get();
	if (!user) {
		verifyPassword(password, DUMMY_HASH);
		return null;
	}
	if (!verifyPassword(password, user.passwordHash)) return null;
	return { id: user.id, username: user.username, createdAt: user.createdAt };
}
