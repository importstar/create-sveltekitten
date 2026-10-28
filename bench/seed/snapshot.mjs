import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// Same hash shape as templates/ssr-fullstack/src/lib/server/auth/password.ts.
// Same tables as templates/ssr-fullstack/src/lib/server/db/client.ts.
// created_at and expires_at are unix seconds, which is what Drizzle's sqlite timestamp mode stores.
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const dest = process.argv[2];
const metaPath = process.argv[3];
if (!dest || !metaPath) {
	console.error('Usage: snapshot.mjs <sqlite.db> <session.json>');
	process.exit(2);
}

const username = 'bench';
const password = 'bench-pass';
const salt = randomBytes(16).toString('hex');
const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const userId = crypto.randomUUID();
const token = randomBytes(32).toString('hex');
const sessionId = createHash('sha256').update(token).digest('hex');
const now = Math.floor(Date.now() / 1000);
const expires = now + 60 * 60 * 24 * 30;

const db = new Database(dest);
db.exec(`
	CREATE TABLE users (
		id TEXT PRIMARY KEY,
		username TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		created_at INTEGER NOT NULL
	);
	CREATE TABLE sessions (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		expires_at INTEGER NOT NULL
	);
	CREATE TABLE items (
		id TEXT PRIMARY KEY,
		user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
		title TEXT NOT NULL,
		description TEXT,
		completed INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL
	);
`);
db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
	userId,
	username,
	passwordHash,
	now
);
db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, userId, expires);
const insertItem = db.prepare(
	'INSERT INTO items (id, user_id, title, description, completed, created_at) VALUES (?, ?, ?, ?, 0, ?)'
);
const writeItems = db.transaction(() => {
	for (let i = 0; i < 1000; i += 1) {
		insertItem.run(crypto.randomUUID(), userId, `Item ${i}`, null, now);
	}
});
writeItems();
db.close();

writeFileSync(
	metaPath,
	JSON.stringify({ username, password, token, userId, itemCount: 1000 }, null, 2) + '\n'
);
console.log(`wrote ${dest} and ${join(dirname(metaPath), 'session.json')}`);
