import { createFile, PATTERN_NOT_FOUND_WARNING, replaceFile, warn } from './helpers.js';
const OLD_FULLSTACK_LOGIN = `import { redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { loginSchema } from '$lib/features/login/schema';
import { logger } from '$lib/logger';
import { setAuthTokens } from '$lib/utils/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '$lib/server/auth/password';
import { createSession, generateSessionToken, setSessionCookie } from '$lib/server/auth/session';

export const load = (async ({ locals }) => {
	if (locals.user) {
		throw redirect(303, '/home');
	}

	const form = await superValidate(zod4(loginSchema));

	return { form };
}) satisfies PageServerLoad;

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const { fastapiClient } = locals;
		const form = await superValidate(request, zod4(loginSchema));

		logger.info({ formData: form.data }, 'Login form data');

		if (!form.valid) {
			return { form };
		}

		// Try FastAPI first if BACKEND_API_URL is configured and not default placeholder
		const backendUrl = process.env.BACKEND_API_URL;
		if (backendUrl && backendUrl !== 'http://localhost:9000') {
			try {
				const result = await fastapiClient.POST('/v1/auth/login', {
					body: {
						username: form.data.username,
						password: form.data.password,
						strategy: 'jwt'
					}
				});
				logger.inspect('FastAPI Login Result', result);

				if (result.data) {
					setAuthTokens(cookies, result.data.access_token, result.data.refresh_token);
					throw redirect(303, '/home');
				}
			} catch (err) {
				if ((err as any)?.status === 303) throw err;
				logger.inspect('FastAPI login failed, checking local database', err);
			}
		}

		// Local Full-Stack SQLite Authentication
		try {
			const existingUser = db
				.select()
				.from(users)
				.where(eq(users.username, form.data.username))
				.get();

			if (!existingUser) {
				// Out-of-the-box user creation for initial onboarding
				const newUserId = crypto.randomUUID();
				const passwordHash = hashPassword(form.data.password);
				db.insert(users)
					.values({
						id: newUserId,
						username: form.data.username,
						passwordHash,
						createdAt: new Date()
					})
					.run();

				const token = generateSessionToken();
				const session = await createSession(token, newUserId);
				setSessionCookie(cookies, token, session.expiresAt);
			} else {
				const valid = verifyPassword(form.data.password, existingUser.passwordHash);
				if (!valid) {
					return message(
						form,
						{
							type: 'error',
							text: 'Invalid username or password.'
						},
						{ status: 400 }
					);
				}

				const token = generateSessionToken();
				const session = await createSession(token, existingUser.id);
				setSessionCookie(cookies, token, session.expiresAt);
			}
		} catch (err) {
			logger.inspect('Local login error', err);
			return message(
				form,
				{
					type: 'error',
					text: 'An error occurred during authentication. Please try again.'
				},
				{ status: 500 }
			);
		}

		throw redirect(303, '/home');
	}
};
`;
const NEW_FULLSTACK_LOGIN = `import { redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { loginSchema } from '$lib/features/login/schema';
import { logger } from '$lib/logger';
import { setAuthTokens } from '$lib/utils/auth';
import { db } from '$lib/server/db';
import { authenticate } from '$lib/server/auth/users';
import { createSession, generateSessionToken, setSessionCookie } from '$lib/server/auth/session';

export const load = (async ({ locals }) => {
	if (locals.user) {
		throw redirect(303, '/home');
	}

	const form = await superValidate(zod4(loginSchema));

	return { form };
}) satisfies PageServerLoad;

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const { fastapiClient } = locals;
		const form = await superValidate(request, zod4(loginSchema));

		if (!form.valid) {
			return { form };
		}

		// Try FastAPI first if BACKEND_API_URL is configured and not default placeholder
		const backendUrl = process.env.BACKEND_API_URL;
		if (backendUrl && backendUrl !== 'http://localhost:9000') {
			try {
				const result = await fastapiClient.POST('/v1/auth/login', {
					body: {
						username: form.data.username,
						password: form.data.password,
						strategy: 'jwt'
					}
				});
				logger.inspect('FastAPI Login Result', result);

				if (result.data) {
					setAuthTokens(cookies, result.data.access_token, result.data.refresh_token);
					throw redirect(303, '/home');
				}
			} catch (err) {
				if ((err as any)?.status === 303) throw err;
				logger.inspect('FastAPI login failed, checking local database', err);
			}
		}

		try {
			const user = await authenticate(db, form.data.username, form.data.password);
			if (!user) {
				return message(
					form,
					{
						type: 'error',
						text: 'Invalid username or password.'
					},
					{ status: 400 }
				);
			}

			const token = generateSessionToken();
			const session = await createSession(token, user.id);
			setSessionCookie(cookies, token, session.expiresAt);
		} catch (err) {
			logger.inspect('Local login error', err);
			return message(
				form,
				{
					type: 'error',
					text: 'An error occurred during authentication. Please try again.'
				},
				{ status: 500 }
			);
		}

		throw redirect(303, '/home');
	}
};
`;
const OLD_BASE_LOGIN = `import { redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { loginSchema } from '$lib/features/login/schema';
import { logger } from '$lib/logger';
import { setAuthTokens, isTokenExpired } from '$lib/utils/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '$lib/server/auth/password';
import { createSession, generateSessionToken, setSessionCookie } from '$lib/server/auth/session';

export const load = (async ({ cookies, locals }) => {
	if (locals.user) {
		throw redirect(303, '/home');
	}
	const refreshToken = cookies.get('refresh_token');
	if (refreshToken && !isTokenExpired(refreshToken)) {
		throw redirect(303, '/home');
	}

	const form = await superValidate(zod4(loginSchema));

	return { form };
}) satisfies PageServerLoad;

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const { fastapiClient } = locals;
		const form = await superValidate(request, zod4(loginSchema));

		logger.info({ formData: form.data }, 'Login form data');

		if (!form.valid) {
			return { form };
		}

		// Try FastAPI first if BACKEND_API_URL is configured and not default placeholder
		const backendUrl = process.env.BACKEND_API_URL;
		if (backendUrl && backendUrl !== 'http://localhost:9000') {
			try {
				const result = await fastapiClient.POST('/v1/auth/login', {
					body: {
						username: form.data.username,
						password: form.data.password,
						strategy: 'jwt'
					}
				});
				logger.inspect('FastAPI Login Result', result);

				if (result.data) {
					setAuthTokens(cookies, result.data.access_token, result.data.refresh_token);
					throw redirect(303, '/home');
				}
			} catch (err) {
				if ((err as any)?.status === 303) throw err;
				logger.inspect('FastAPI login failed, checking local database', err);
			}
		}

		// Local Full-Stack SQLite Authentication
		try {
			const existingUser = db
				.select()
				.from(users)
				.where(eq(users.username, form.data.username))
				.get();

			if (!existingUser) {
				// Out-of-the-box user creation for initial onboarding
				const newUserId = crypto.randomUUID();
				const passwordHash = hashPassword(form.data.password);
				db.insert(users)
					.values({
						id: newUserId,
						username: form.data.username,
						passwordHash,
						createdAt: new Date()
					})
					.run();

				const token = generateSessionToken();
				const session = await createSession(token, newUserId);
				setSessionCookie(cookies, token, session.expiresAt);
			} else {
				const valid = verifyPassword(form.data.password, existingUser.passwordHash);
				if (!valid) {
					return message(
						form,
						{
							type: 'error',
							text: 'Invalid username or password.'
						},
						{ status: 400 }
					);
				}

				const token = generateSessionToken();
				const session = await createSession(token, existingUser.id);
				setSessionCookie(cookies, token, session.expiresAt);
			}
		} catch (err) {
			logger.inspect('Local login error', err);
			return message(
				form,
				{
					type: 'error',
					text: 'An error occurred during authentication. Please try again.'
				},
				{ status: 500 }
			);
		}

		throw redirect(303, '/home');
	}
};
`;
const NEW_BASE_LOGIN = `import { redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { loginSchema } from '$lib/features/login/schema';
import { logger } from '$lib/logger';
import { setAuthTokens, isTokenExpired } from '$lib/utils/auth';
import { db } from '$lib/server/db';
import { authenticate } from '$lib/server/auth/users';
import { createSession, generateSessionToken, setSessionCookie } from '$lib/server/auth/session';

export const load = (async ({ cookies, locals }) => {
	if (locals.user) {
		throw redirect(303, '/home');
	}
	const refreshToken = cookies.get('refresh_token');
	if (refreshToken && !isTokenExpired(refreshToken)) {
		throw redirect(303, '/home');
	}

	const form = await superValidate(zod4(loginSchema));

	return { form };
}) satisfies PageServerLoad;

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const { fastapiClient } = locals;
		const form = await superValidate(request, zod4(loginSchema));

		if (!form.valid) {
			return { form };
		}

		// Try FastAPI first if BACKEND_API_URL is configured and not default placeholder
		const backendUrl = process.env.BACKEND_API_URL;
		if (backendUrl && backendUrl !== 'http://localhost:9000') {
			try {
				const result = await fastapiClient.POST('/v1/auth/login', {
					body: {
						username: form.data.username,
						password: form.data.password,
						strategy: 'jwt'
					}
				});
				logger.inspect('FastAPI Login Result', result);

				if (result.data) {
					setAuthTokens(cookies, result.data.access_token, result.data.refresh_token);
					throw redirect(303, '/home');
				}
			} catch (err) {
				if ((err as any)?.status === 303) throw err;
				logger.inspect('FastAPI login failed, checking local database', err);
			}
		}

		try {
			const user = await authenticate(db, form.data.username, form.data.password);
			if (!user) {
				return message(
					form,
					{
						type: 'error',
						text: 'Invalid username or password.'
					},
					{ status: 400 }
				);
			}

			const token = generateSessionToken();
			const session = await createSession(token, user.id);
			setSessionCookie(cookies, token, session.expiresAt);
		} catch (err) {
			logger.inspect('Local login error', err);
			return message(
				form,
				{
					type: 'error',
					text: 'An error occurred during authentication. Please try again.'
				},
				{ status: 500 }
			);
		}

		throw redirect(303, '/home');
	}
};
`;
const USERS = `import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users, type User } from '../db/schema';
import { hashPassword, verifyPassword } from './password';

export class UsernameTakenError extends Error {
	constructor(username: string) {
		super(\`Username "\${username}" is already taken.\`);
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
`;
const USERS_TEST = `import { describe, expect, it } from 'vitest';
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
`;
const USER_CREATE_SCRIPT = `import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createDb } from '../src/lib/server/db/client';
import { createUser, UsernameTakenError } from '../src/lib/server/auth/users';
import { loginSchema } from '../src/lib/features/login/schema';

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}

function promptHidden(prompt: string): Promise<string> {
	return new Promise((resolve) => {
		const { stdin, stdout } = process;
		stdout.write(prompt);
		stdin.setRawMode(true);
		stdin.resume();
		stdin.setEncoding('utf8');
		let value = '';
		const onData = (chunk: string) => {
			for (const char of chunk) {
				if (char === '\\r' || char === '\\n') {
					stdin.setRawMode(false);
					stdin.pause();
					stdin.off('data', onData);
					stdout.write('\\n');
					resolve(value);
					return;
				}
				if (char === '\\u0003') {
					stdin.setRawMode(false);
					stdout.write('\\n');
					process.exit(130);
				}
				if (char === '\\u007f' || char === '\\b') {
					value = value.slice(0, -1);
				} else {
					value += char;
				}
			}
		};
		stdin.on('data', onData);
	});
}

async function readFirstLine(): Promise<string> {
	const rl = createInterface({ input: process.stdin });
	for await (const line of rl) {
		rl.close();
		return line;
	}
	return '';
}

async function readPassword(): Promise<string> {
	if (!process.stdin.isTTY) return readFirstLine();
	const password = await promptHidden('Password: ');
	const confirmation = await promptHidden('Confirm password: ');
	if (password !== confirmation) fail('Passwords do not match.');
	return password;
}

const username = process.argv[2];
if (!username) fail('Usage: pnpm user:create <username>');

if (existsSync('.env')) process.loadEnvFile('.env');

const parsed = loginSchema.safeParse({ username, password: await readPassword() });
if (!parsed.success) fail(parsed.error.issues.map((issue) => issue.message).join('\\n'));

const db = createDb(process.env.DATABASE_URL || 'sqlite.db');
try {
	const user = await createUser(db, parsed.data.username, parsed.data.password);
	console.log(\`Created user \${user.username}\`);
} catch (err) {
	if (err instanceof UsernameTakenError) fail(err.message);
	throw err;
}
`;
const OLD_PLAYWRIGHT_CONFIG = `/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	use: {
		baseURL: 'http://localhost:3000',
		trace: 'on-first-retry',
		launchOptions: {
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
		},
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: [
		{
			command: 'node e2e/mock-api.js',
			url: 'http://localhost:9001/v1/health',
			reuseExistingServer: !process.env.CI,
			timeout: 15_000,
		},
		{
			command: \`\${process.execPath} build\`,
			url: 'http://localhost:3000',
			reuseExistingServer: !process.env.CI,
			env: {
				BACKEND_API_URL: 'http://localhost:9001',
				NODE_ENV: 'test',
				ORIGIN: 'http://localhost:3000',
			},
			timeout: 120_000,
		},
	],
});
`;
const NEW_FULLSTACK_PLAYWRIGHT_CONFIG = `/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	globalSetup: './e2e/global-setup.ts',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	use: {
		baseURL: 'http://localhost:3000',
		trace: 'on-first-retry',
		launchOptions: {
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
		},
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: \`\${process.execPath} build\`,
		url: 'http://localhost:3000',
		reuseExistingServer: !process.env.CI,
		env: {
			DATABASE_URL: 'e2e.db',
			NODE_ENV: 'test',
			ORIGIN: 'http://localhost:3000',
		},
		timeout: 120_000,
	},
});
`;
const E2E_GLOBAL_SETUP = `import { eq } from 'drizzle-orm';
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
`;
const OLD_LOGGER = `import { dev } from '$app/environment';
import pino from 'pino';

// Create different logger configurations for server and browser
const createLogger = () => {
	return pino({
		level: dev ? 'debug' : 'info',
		transport: dev
			? {
					target: 'pino-pretty',
					options: {
						colorize: true,
						translateTime: 'SYS:yyyy-mm-dd HH:MM:ss'
					}
				}
			: undefined
	});
};

const baseLogger = createLogger();

export const logger = Object.assign(baseLogger, {
	inspect: (...args: any[]) => {
		if (dev) {
			console.log(...args);
		}
	},
	dir: (obj: any, options?: any) => {
		if (dev) {
			console.dir(obj, options);
		}
	},
	table: (data: any, columns?: string[]) => {
		if (dev) {
			console.table(data, columns);
		}
	}
});
`;
const NEW_LOGGER = `import { dev } from '$app/environment';
import pino from 'pino';

// Create different logger configurations for server and browser
const createLogger = () => {
	return pino({
		level: dev ? 'debug' : 'info',
		redact: [
			'password',
			'*.password',
			'cookie',
			'*.cookie',
			'authorization',
			'*.authorization',
			'req.headers.cookie',
			'req.headers.authorization'
		],
		transport: dev
			? {
					target: 'pino-pretty',
					options: {
						colorize: true,
						translateTime: 'SYS:yyyy-mm-dd HH:MM:ss'
					}
				}
			: undefined
	});
};

const baseLogger = createLogger();

export const logger = Object.assign(baseLogger, {
	inspect: (...args: any[]) => {
		if (dev) {
			console.log(...args);
		}
	},
	dir: (obj: any, options?: any) => {
		if (dev) {
			console.dir(obj, options);
		}
	},
	table: (data: any, columns?: string[]) => {
		if (dev) {
			console.table(data, columns);
		}
	}
});
`;
const OLD_DB_INDEX = `import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';

const dbPath = env.DATABASE_URL || 'sqlite.db';
const sqlite = building ? new Database(':memory:') : new Database(dbPath);

if (!building) {
	sqlite.pragma('journal_mode = WAL');
	// Ensure tables exist on startup for zero-config out-of-the-box experience
	sqlite.exec(\`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			created_at INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS items (
			id TEXT PRIMARY KEY,
			user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
			title TEXT NOT NULL,
			description TEXT,
			completed INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL
		);
	\`);
}

export const db = drizzle(sqlite, { schema });
`;
const NEW_DB_INDEX = `import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { createDb } from './client';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';

export const db = building
	? drizzle(new Database(':memory:'), { schema })
	: createDb(env.DATABASE_URL || 'sqlite.db');
`;
const DB_CLIENT = `import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema>;

export function createDb(path: string): Db {
	const sqlite = new Database(path);
	sqlite.pragma('journal_mode = WAL');
	// Ensure tables exist on startup for zero-config out-of-the-box experience
	sqlite.exec(\`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			created_at INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS items (
			id TEXT PRIMARY KEY,
			user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
			title TEXT NOT NULL,
			description TEXT,
			completed INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL
		);
	\`);
	return drizzle(sqlite, { schema });
}
`;
const USERS_NOTE = `- **Users**: login never creates users, in either mode. In fullstack mode, create accounts with \`pnpm user:create <username>\`.
`;
// Re-serializes only when the edit changed something, so an untouched file keeps its formatting.
function editPackageJson(edit) {
    return (content) => {
        try {
            const pkg = JSON.parse(content);
            const before = JSON.stringify(pkg);
            edit(pkg);
            return JSON.stringify(pkg) === before ? content : JSON.stringify(pkg, null, '\t') + '\n';
        }
        catch {
            return warn(content, 'is not valid JSON, so it was left as is; apply this change by hand (see CHANGELOG)');
        }
    };
}
function insertUsersNoteBefore(anchor) {
    return (content) => {
        if (content.includes(USERS_NOTE))
            return content;
        if (!content.includes(anchor))
            return warn(content, PATTERN_NOT_FOUND_WARNING);
        return content.replace(anchor, USERS_NOTE + anchor);
    };
}
const codemod = {
    from: '0.3.20',
    to: '0.3.21',
    transforms: [
        {
            file: 'src/routes/login/+page.server.ts',
            template: 'ssr',
            ssrMode: 'fullstack',
            transform: replaceFile(OLD_FULLSTACK_LOGIN, NEW_FULLSTACK_LOGIN)
        },
        {
            file: 'src/routes/login/+page.server.ts',
            template: 'ssr',
            ssrMode: 'fastapi',
            transform: replaceFile(OLD_BASE_LOGIN, NEW_BASE_LOGIN)
        },
        {
            // Runs after the exact replaces (a no-op there); strips the password-leaking log
            // line from every other SSR login, edited or not.
            file: 'src/routes/login/+page.server.ts',
            template: 'ssr',
            transform: (content) => content.replace(/\t\tlogger\.info\(\{ formData: form\.data \}, 'Login form data'\);\r?\n(\r?\n)?/, '')
        },
        {
            file: 'src/lib/server/auth/users.ts',
            create: true,
            template: 'ssr',
            transform: createFile(USERS)
        },
        {
            file: 'src/lib/server/auth/users.test.ts',
            create: true,
            template: 'ssr',
            transform: createFile(USERS_TEST)
        },
        {
            file: 'scripts/user-create.ts',
            create: true,
            template: 'ssr',
            ssrMode: 'fullstack',
            transform: createFile(USER_CREATE_SCRIPT)
        },
        {
            file: 'playwright.config.ts',
            template: 'ssr',
            ssrMode: 'fullstack',
            transform: replaceFile(OLD_PLAYWRIGHT_CONFIG, NEW_FULLSTACK_PLAYWRIGHT_CONFIG)
        },
        {
            file: 'e2e/global-setup.ts',
            create: true,
            template: 'ssr',
            ssrMode: 'fullstack',
            transform: createFile(E2E_GLOBAL_SETUP)
        },
        {
            file: 'package.json',
            template: 'ssr',
            transform: editPackageJson((pkg) => {
                if (pkg.devDependencies?.tsx)
                    return;
                pkg.devDependencies = Object.fromEntries(Object.entries({ ...pkg.devDependencies, tsx: '^4.23.15' }).sort(([a], [b]) => a.localeCompare(b)));
            })
        },
        {
            file: 'package.json',
            template: 'ssr',
            ssrMode: 'fullstack',
            transform: editPackageJson((pkg) => {
                if (pkg.scripts?.['user:create'])
                    return;
                pkg.scripts = { ...pkg.scripts, 'user:create': 'tsx scripts/user-create.ts' };
            })
        },
        {
            file: 'src/lib/logger.ts',
            template: 'ssr',
            transform: replaceFile(OLD_LOGGER, NEW_LOGGER)
        },
        {
            file: 'src/lib/server/db/client.ts',
            create: true,
            template: 'ssr',
            transform: createFile(DB_CLIENT)
        },
        {
            file: 'src/lib/server/db/index.ts',
            template: 'ssr',
            transform: replaceFile(OLD_DB_INDEX, NEW_DB_INDEX)
        },
        {
            file: 'AGENTS.md',
            template: 'ssr',
            transform: insertUsersNoteBefore('- Protected pages go inside `src/routes/(protected)/`')
        },
        {
            file: 'agent-role.md',
            template: 'ssr',
            transform: insertUsersNoteBefore('- **Protected pages must live inside `(protected)/`**')
        }
    ]
};
export default codemod;
