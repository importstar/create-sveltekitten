import { existsSync } from 'node:fs';
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
				if (char === '\r' || char === '\n') {
					stdin.setRawMode(false);
					stdin.pause();
					stdin.off('data', onData);
					stdout.write('\n');
					resolve(value);
					return;
				}
				if (char === '\u0003') {
					stdin.setRawMode(false);
					stdout.write('\n');
					process.exit(130);
				}
				if (char === '\u007f' || char === '\b') {
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
if (!parsed.success) fail(parsed.error.issues.map((issue) => issue.message).join('\n'));

const db = createDb(process.env.DATABASE_URL || 'sqlite.db');
try {
	const user = await createUser(db, parsed.data.username, parsed.data.password);
	console.log(`Created user ${user.username}`);
} catch (err) {
	if (err instanceof UsernameTakenError) fail(err.message);
	throw err;
}
