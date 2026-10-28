import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findLeftovers } from '../dist/codemods/apply.js';
import { makeTempDir } from './helpers/cli.js';
import { codemodTo, runCodemodFixtureWithWarnings } from './helpers/codemods.js';

// Logging + OpenTelemetry (issue #16). The fixtures in fixtures/codemods/2.1.0/ cover the template
// files; this file covers edited files, code the user wrote, and running the patch twice.

const FIXTURES = fileURLToPath(new URL('./fixtures/codemods/', import.meta.url));
const codemod = codemodTo('2.1.0');
const leftovers = (files: Map<string, string>) => findLeftovers(files, codemod.leftovers!.pattern);

describe('codemod 2.0.0 → 2.1.0', () => {
	let project: string;
	const edit = async (file: string, change: (content: string) => string) => {
		const path = join(project, file);
		await writeFile(path, change(await readFile(path, 'utf-8')));
	};
	const setUp = async (variant: string) => {
		project = await makeTempDir();
		await cp(join(FIXTURES, '2.1.0', variant, 'input'), project, { recursive: true });
	};
	afterEach(async () => {
		await rm(project, { recursive: true, force: true });
	});

	describe.each(['ssr-fullstack', 'ssr-fastapi'])('%s', (variant) => {
		beforeEach(() => setUp(variant));

		it('moves the logger and leaves nothing that imports the old one', async () => {
			const run = await runCodemodFixtureWithWarnings('2.1.0', project);
			expect(run.warnings).toEqual([]);
			expect(run.deleted).toEqual(['src/lib/logger.ts']);
			expect(run.files.get('src/lib/server/logger.ts')).toContain('mixin: traceFields');
			expect(leftovers(run.files)).toEqual([]);
		});

		it('changes nothing when run again on its own output', async () => {
			const first = await runCodemodFixtureWithWarnings('2.1.0', project);
			for (const change of first.changes) {
				if (change.delete) await rm(join(project, change.file));
				else {
					await mkdir(dirname(join(project, change.file)), { recursive: true });
					await writeFile(join(project, change.file), change.content);
				}
			}
			const second = await runCodemodFixtureWithWarnings('2.1.0', project);
			expect(second.changes).toEqual([]);
			expect(second.warnings).toEqual([]);
		});

		it('keeps an edited hooks.server.ts and says what to add', async () => {
			await edit('src/hooks.server.ts', (c) => c + '\n// my hook\n');
			const run = await runCodemodFixtureWithWarnings('2.1.0', project);
			expect(run.warnings).toEqual([
				expect.objectContaining({
					file: 'src/hooks.server.ts',
					message: expect.stringContaining("export { handleError } from '#lib/hooks/handle-error.js'")
				})
			]);
		});

		it('still moves the logger import of an edited login action, and warns about the rest', async () => {
			// A line of the user's inside a spot the codemod changes.
			await edit('src/routes/login/+page.server.ts', (c) =>
				c.replace(/(if \((?:!user|status === 400[^)]*)\) \{\n)/, '$1// mine\n')
			);
			const run = await runCodemodFixtureWithWarnings('2.1.0', project);
			const login = run.files.get('src/routes/login/+page.server.ts')!;
			expect(login).toContain("import { logger } from '#lib/server/logger.js';");
			expect(run.warnings.map((w) => w.file)).toEqual(['src/routes/login/+page.server.ts']);
		});

		it('keeps an edited old logger, with a warning, and lists the files that still need it', async () => {
			await edit('src/lib/logger.ts', (c) => c.replace("'password',", "'password',\n\t\t\t'ssn',"));
			const run = await runCodemodFixtureWithWarnings('2.1.0', project);
			expect(run.deleted).toEqual([]);
			expect(run.warnings).toEqual([
				expect.objectContaining({ file: 'src/lib/logger.ts', message: expect.stringContaining('src/lib/server/logger.ts') })
			]);
		});

		it('adds the OpenTelemetry packages next to dependencies the user added, and warns on other JSON formatting', async () => {
			await edit('package.json', (c) => {
				const pkg = JSON.parse(c);
				pkg.dependencies.dayjs = '^1.11.0';
				pkg.dependencies['@opentelemetry/api'] = '^1.8.0';
				// Sorted, as pnpm add writes it.
				pkg.dependencies = Object.fromEntries(Object.entries(pkg.dependencies).sort(([a], [b]) => (a < b ? -1 : 1)));
				return JSON.stringify(pkg, null, '\t') + '\n';
			});
			const pkg = JSON.parse((await runCodemodFixtureWithWarnings('2.1.0', project)).files.get('package.json')!);
			expect(pkg.dependencies.dayjs).toBe('^1.11.0');
			expect(pkg.dependencies['@opentelemetry/api']).toBe('^1.8.0');
			expect(pkg.dependencies['@opentelemetry/sdk-trace']).toBe('^2.12.0');
			expect(Object.keys(pkg.dependencies)).toEqual([...Object.keys(pkg.dependencies)].sort());

			await edit('package.json', (c) => JSON.stringify(JSON.parse(c), null, 2) + '\n');
			const run = await runCodemodFixtureWithWarnings('2.1.0', project);
			expect(run.warnings).toEqual([
				expect.objectContaining({ file: 'package.json', message: expect.stringContaining('"@opentelemetry/sdk-trace": "^2.12.0"') })
			]);
		});

		it('appends the optional variables to an edited .env.example', async () => {
			await edit('.env.example', (c) => c + 'MY_VAR=1');
			const env = (await runCodemodFixtureWithWarnings('2.1.0', project)).files.get('.env.example')!;
			expect(env).toMatch(/MY_VAR=1\n# Optional: logging and tracing/);
		});
	});

	it('lists code the user wrote that imports the old logger or calls logger.inspect', () => {
		const files = new Map([
			['src/routes/notes/+page.server.ts', "import { logger } from '#lib/logger.js';\nlogger.info('x');\n"],
			['src/lib/legacy.ts', "import { logger } from '$lib/logger';\n"],
			['src/lib/debug.ts', "logger.inspect('state', state);\n"],
			['src/lib/fine.ts', "import { logger } from '#lib/server/logger.js';\n"]
		]);
		expect(leftovers(files)).toEqual(['src/lib/debug.ts', 'src/lib/legacy.ts', 'src/routes/notes/+page.server.ts']);
	});

	it('only documents the logger in SPA projects', async () => {
		await setUp('spa');
		const run = await runCodemodFixtureWithWarnings('2.1.0', project);
		expect([...run.files.keys()]).toEqual(['agent-role.md']);
		expect(run.files.get('agent-role.md')).toContain('**No logger**');
	});

	it('tells the user to install the new packages', () => {
		expect(codemod.notes?.join('\n')).toContain('pnpm install');
	});
});
