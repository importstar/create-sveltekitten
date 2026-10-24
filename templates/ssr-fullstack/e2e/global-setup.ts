import { eq } from 'drizzle-orm';
import { createDb } from '../src/lib/server/db/client';
import { users } from '../src/lib/server/db/schema';
import { createUser } from '../src/lib/server/auth/users';

// Matches VALID in login.test.ts. The web server may already hold e2e.db open, so reset
// the row rather than the file.
const ADMIN = { username: 'admin', password: 'secret' };

export default async function globalSetup() {
	const db = createDb('e2e.db');
	db.delete(users).where(eq(users.username, ADMIN.username)).run();
	await createUser(db, ADMIN.username, ADMIN.password);
}
