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
	'BACKEND_API_URL (FastAPI base URL)',
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
			env: 'PUBLIC_APP_TITLE=demo\nDATABASE_URL=sqlite.db\nBACKEND_API_URL=http://localhost:9000\n',
			config: { version, template: 'ssr', ssrMode: 'fullstack' },
			fullstackOverlay: true
		},
		{
			args: ['--template', 'ssr', '--mode', 'fastapi', '--backend-url', 'http://api.test:8000'],
			env: 'PUBLIC_APP_TITLE=demo\nDATABASE_URL=sqlite.db\nBACKEND_API_URL=http://api.test:8000\n',
			config: { version, template: 'ssr', ssrMode: 'fastapi' },
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
		[['--name', 'demo', '--template', 'ssr', '--mode', 'django', '--yes'], 'Invalid --mode "django". Allowed: fullstack, fastapi.'],
		[['--name', 'demo', '--template', 'spa', '--mode', 'fastapi', '--yes'], '--mode only applies to --template ssr.'],
		[['--template', 'spa', '--yes'], '--yes needs --name.'],
		[['--name', 'demo', '--yes'], '--yes needs --template (ssr or spa).'],
		[['--name', 'demo', '--template', 'ssr', '--yes'], '--yes with --template ssr needs --mode (fullstack or fastapi).'],
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
