import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function mustReplace(text, from, to, file) {
	if (!text.includes(from)) {
		throw new Error(`${file} has no "${from}". The template changed. Refusing to guess.`);
	}
	return text.replaceAll(from, to);
}

// Bench copy only. The template in the repo stays on Kit tracing.
export async function disableTracing(dir) {
	const file = join(dir, 'vite.config.ts');
	const text = await readFile(file, 'utf8');
	await writeFile(file, mustReplace(text, 'tracing: { server: true }', 'tracing: { server: false }', file));
}

// Bench copy only. The package name is the one issue 23 names.
export async function useCommunityAdapter(dir, packageName) {
	const file = join(dir, 'vite.config.ts');
	const text = await readFile(file, 'utf8');
	await writeFile(file, mustReplace(text, '@sveltejs/adapter-node', packageName, file));
	const pkgPath = join(dir, 'package.json');
	const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
	pkg.devDependencies[packageName] = 'latest';
	await writeFile(pkgPath, JSON.stringify(pkg, null, '\t') + '\n');
}

// Bench copy only, and only for R4. Drops better-sqlite3 so Bun does not have to compile it.
export async function useBunSqlite(dir) {
	const client = join(dir, 'src/lib/server/db/client.ts');
	const index = join(dir, 'src/lib/server/db/index.ts');
	let clientText = await readFile(client, 'utf8');
	clientText = mustReplace(clientText, "import Database from 'better-sqlite3';", "import { Database } from 'bun:sqlite';", client);
	clientText = mustReplace(
		clientText,
		"import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';",
		"import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';",
		client
	);
	clientText = mustReplace(
		clientText,
		'export type Db = BetterSQLite3Database<typeof schema>;',
		'export type Db = BunSQLiteDatabase<typeof schema>;',
		client
	);
	clientText = mustReplace(clientText, "sqlite.pragma('journal_mode = WAL');", "sqlite.exec('PRAGMA journal_mode = WAL');", client);
	await writeFile(client, clientText);

	let indexText = await readFile(index, 'utf8');
	indexText = mustReplace(indexText, "import Database from 'better-sqlite3';", "import { Database } from 'bun:sqlite';", index);
	indexText = mustReplace(
		indexText,
		"import { drizzle } from 'drizzle-orm/better-sqlite3';",
		"import { drizzle } from 'drizzle-orm/bun-sqlite';",
		index
	);
	await writeFile(index, indexText);

	const pkgPath = join(dir, 'package.json');
	const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
	delete pkg.dependencies['better-sqlite3'];
	delete pkg.devDependencies['@types/better-sqlite3'];
	await writeFile(pkgPath, JSON.stringify(pkg, null, '\t') + '\n');
}
