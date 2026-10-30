import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTempDir, runCli } from './helpers/cli.js';

const version: string = JSON.parse(
	readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
).version;

// Messages of the interactive prompts; none may appear when every value comes from a flag.
const PROMPTS = [
	'Project name',
	'Template',
	'Backend architecture for SSR',
	'BACKEND_API_URL (API base URL)',
	'PUBLIC_API_URL (backend base URL)',
	'already exists. Overwrite?'
];

let cwd: string;
beforeEach(async () => {
	cwd = await makeTempDir();
});
afterEach(async () => {
	await rm(cwd, { recursive: true, force: true });
});

const read = (file: string) => readFileSync(join(cwd, file), 'utf-8');

describe('scaffold with every flag and --yes', () => {
	it.each([
		{
			args: ['--template', 'ssr', '--mode', 'fullstack'],
			env: 'PUBLIC_APP_TITLE=demo\nDATABASE_URL=sqlite.db\n',
			config: { version, template: 'ssr', ssrMode: 'fullstack' },
			fullstackOverlay: true
		},
		{
			args: ['--template', 'ssr', '--mode', 'openapi', '--backend-url', 'http://api.test:8000'],
			env: 'PUBLIC_APP_TITLE=demo\nBACKEND_API_URL=http://api.test:8000\n',
			config: { version, template: 'ssr', ssrMode: 'openapi' },
			fullstackOverlay: false
		},
		{
			args: ['--template', 'spa', '--backend-url', 'http://api.test:8000'],
			env: 'PUBLIC_APP_TITLE=demo\nPUBLIC_API_URL=http://api.test:8000\n',
			config: { version, template: 'spa' },
			fullstackOverlay: false
		}
	])('$config.template $config.ssrMode', ({ args, env, config, fullstackOverlay }) => {
		const result = runCli(cwd, ['--name', 'demo', ...args, '--yes']);

		expect(result.timedOut).toBe(false);
		expect(result.status, result.output).toBe(0);
		for (const prompt of PROMPTS) expect(result.output).not.toContain(prompt);
		expect(result.output).toContain('Project scaffolded!');

		expect(read('demo/.env')).toBe(env);
		expect(JSON.parse(read('demo/.sveltekitten.json'))).toEqual(config);
		expect(JSON.parse(read('demo/package.json')).name).toBe('demo');
		expect(existsSync(join(cwd, 'demo/.gitignore'))).toBe(true);
		expect(existsSync(join(cwd, 'demo/scripts/user-create.ts'))).toBe(fullstackOverlay);
		expect(JSON.parse(read('demo/package.json')).scripts['user:create'] !== undefined).toBe(
			fullstackOverlay
		);
	});

	it('defaults --backend-url to http://localhost:9000', () => {
		const result = runCli(cwd, ['--name', 'demo', '--template', 'spa', '--yes']);
		expect(result.status, result.output).toBe(0);
		expect(read('demo/.env')).toBe('PUBLIC_APP_TITLE=demo\nPUBLIC_API_URL=http://localhost:9000\n');
	});
});

const allDependencies = (pkg: Record<string, Record<string, string> | undefined>) => ({
	...pkg.dependencies,
	...pkg.devDependencies
});

// Each SSR mode ships only its own code and dependencies (issue #2, AC1 and AC2).
describe.each([
	{
		mode: 'fullstack',
		present: ['src/lib/server/db/index.ts', 'src/lib/server/auth/session.ts', 'drizzle.config.ts', 'src/lib/features/items/service.ts', 'pnpm-lock.yaml'],
		absent: ['src/routes/api/proxy', 'src/lib/api/api-client.ts', 'src/lib/hooks/api-client.hook.ts', 'src/libs/api-specs', 'e2e/mock-api.js'],
		dependencies: ['better-sqlite3', 'drizzle-orm'],
		noDependencies: ['jsonwebtoken', '@types/jsonwebtoken', 'openapi-fetch', 'openapi-typescript'],
		noScripts: /^openapi/
	},
	{
		mode: 'openapi',
		present: ['src/routes/api/proxy/[...slug]/+server.ts', 'src/lib/api/api-client.ts', 'src/libs/api-specs/openapi.json', 'e2e/mock-api.js', 'pnpm-lock.yaml'],
		absent: ['src/lib/server/db', 'src/lib/server/auth', 'drizzle.config.ts', 'src/lib/features/items/server.ts', 'src/lib/features/items/service.ts', 'src/routes/api/items', 'scripts/user-create.ts'],
		dependencies: ['jsonwebtoken', 'openapi-fetch'],
		noDependencies: ['better-sqlite3', '@types/better-sqlite3', 'drizzle-orm', 'drizzle-kit'],
		noScripts: /^(db|user):/
	}
])('ssr $mode contains only its own mode', ({ mode, present, absent, dependencies, noDependencies, noScripts }) => {
	it('files, dependencies and scripts', () => {
		const result = runCli(cwd, ['--name', 'demo', '--template', 'ssr', '--mode', mode, '--yes']);
		expect(result.status, result.output).toBe(0);

		for (const file of present) expect(existsSync(join(cwd, 'demo', file)), file).toBe(true);
		for (const file of absent) expect(existsSync(join(cwd, 'demo', file)), file).toBe(false);

		const pkg = JSON.parse(read('demo/package.json'));
		const deps = Object.keys(allDependencies(pkg));
		for (const dep of dependencies) expect(deps).toContain(dep);
		for (const dep of noDependencies) expect(deps).not.toContain(dep);
		expect(Object.keys(pkg.scripts).filter((s) => noScripts.test(s))).toEqual([]);

		// The lockfile must list exactly this mode's dependencies, or install --frozen-lockfile fails.
		const importer = read('demo/pnpm-lock.yaml').split(/^packages:$/m)[0];
		const locked = [...importer.matchAll(/^ {6}'?([^'\s]+?)'?:$/gm)].map((m) => m[1]);
		expect(locked.sort()).toEqual(deps.sort());
	});
});

describe('flag errors exit non-zero', () => {
	it('refuses an existing directory with --yes and leaves it untouched', async () => {
		await mkdir(join(cwd, 'demo'));
		await writeFile(join(cwd, 'demo/keep.txt'), 'mine');

		const result = runCli(cwd, ['--name', 'demo', '--template', 'spa', '--yes']);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain('already exists');
		expect(readdirSync(join(cwd, 'demo'))).toEqual(['keep.txt']);
		expect(read('demo/keep.txt')).toBe('mine');
	});

	it.each([
		[['--name', 'demo', '--template', 'vue', '--yes'], 'Invalid --template "vue". Allowed: ssr, spa.'],
		[['--template', 'vue'], 'Invalid --template "vue". Allowed: ssr, spa.'],
		[['--name', 'demo', '--template', 'ssr', '--mode', 'django', '--yes'], 'Invalid --mode "django". Allowed: fullstack, openapi.'],
		[['--name', 'demo', '--template', 'ssr', '--mode', 'fastapi', '--yes'], 'The SSR mode "fastapi" was renamed to "openapi".'],
		[['--name', 'demo', '--template', 'spa', '--mode', 'openapi', '--yes'], '--mode only applies to --template ssr.'],
		[['--template', 'spa', '--yes'], '--yes needs --name.'],
		[['--name', 'demo', '--yes'], '--yes needs --template (ssr or spa).'],
		[['--name', 'demo', '--template', 'ssr', '--yes'], '--yes with --template ssr needs --mode (fullstack or openapi).'],
		[['--name', '  ', '--template', 'spa', '--yes'], '--name must not be empty.'],
		[['--nmae', 'demo'], "Unknown option '--nmae'"]
	])('%j', (args, message) => {
		const result = runCli(cwd, args);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain(message);
		expect(readdirSync(cwd)).toEqual([]);
	});
});

describe('missing flags without --yes', () => {
	it('prompts only for the missing value', () => {
		const result = runCli(cwd, ['--name', 'demo', '--template', 'spa']);

		expect(result.timedOut).toBe(false);
		expect(result.output).toContain('PUBLIC_API_URL (backend base URL)');
		expect(result.output).not.toContain('Project name');
		expect(result.output).not.toContain('Template');
	});
});
