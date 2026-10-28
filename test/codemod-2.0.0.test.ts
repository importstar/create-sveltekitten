import { cp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findLeftovers } from '../dist/codemods/apply.js';
import {
	deleteFile,
	EDITED_FILE_WARNING,
	PATTERN_NOT_FOUND_WARNING,
	replaceTexts
} from '../dist/codemods/helpers.js';
import { makeTempDir } from './helpers/cli.js';
import { codemodTo, runCodemodFixtureWithWarnings } from './helpers/codemods.js';

// SvelteKit 3 (issue #15). The per-variant fixtures in fixtures/codemods/2.0.0/ cover the
// template files; this file covers what they cannot: files the user wrote, edited config files,
// and the helpers the codemod is built from.

const FIXTURES = fileURLToPath(new URL('./fixtures/codemods/', import.meta.url));
const VARIANTS = ['ssr-fullstack', 'ssr-fastapi', 'spa'];
const codemod = codemodTo('2.0.0');
const leftovers = (files: Map<string, string>) => findLeftovers(files, codemod.leftovers!.pattern);

async function readTree(root: string): Promise<Map<string, string>> {
	const files = new Map<string, string>();
	for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
		if (!entry.isFile()) continue;
		const full = join(entry.parentPath, entry.name);
		files.set(relative(root, full), await readFile(full, 'utf-8'));
	}
	return files;
}

describe('replaceTexts', () => {
	const transform = replaceTexts([
		["import a from '$lib/a';\n", "import a from '#lib/a.js';\n"],
		['x\n', 'x\ny\n']
	]);

	it('applies every hunk, once', () => {
		expect(transform("import a from '$lib/a';\nx\n")).toBe("import a from '#lib/a.js';\nx\ny\n");
	});

	it('leaves an already migrated file alone, even when a hunk keeps its context line', () => {
		expect(transform("import a from '#lib/a.js';\nx\ny\n")).toBe("import a from '#lib/a.js';\nx\ny\n");
	});

	it('changes nothing and warns when one hunk is missing', () => {
		expect(transform("import a from '$lib/other';\nx\n")).toEqual({
			content: "import a from '$lib/other';\nx\n",
			warnings: [PATTERN_NOT_FOUND_WARNING]
		});
	});
});

describe('deleteFile', () => {
	it('deletes the template file and keeps an edited one with a warning', () => {
		expect(deleteFile('old\n')('old\r\n')).toEqual({ content: '', warnings: [], delete: true });
		expect(deleteFile('old\n')('mine\n')).toEqual({ content: 'mine\n', warnings: [EDITED_FILE_WARNING] });
	});
});

describe('codemod 1.1.4 → 2.0.0', () => {
	it.each(VARIANTS)('%s: deletes svelte.config.js and leaves no SvelteKit 2 API in the files it owns', async (variant) => {
		const run = await runCodemodFixtureWithWarnings('2.0.0', join(FIXTURES, '2.0.0', variant, 'input'));
		expect(run.deleted).toEqual(['svelte.config.js']);
		expect(run.changes.find((c) => c.file === 'svelte.config.js')).toMatchObject({ delete: true });
		expect(leftovers(run.files)).toEqual([]);
		// The 1.1.4 input does use them: the pattern is not trivially empty.
		expect(leftovers(await readTree(join(FIXTURES, '2.0.0', variant, 'input'))).length).toBeGreaterThan(50);
	});

	it('tells the user to run sv migrate for their own code', () => {
		expect(codemod.notes?.join('\n')).toContain('npx sv migrate sveltekit-3');
		expect(codemod.notes?.join('\n')).toContain('pnpm install');
	});
});

describe('codemod 1.1.4 → 2.0.0 in a project with files the user wrote (AC2 edge)', () => {
	let project: string;
	const overlay = join(FIXTURES, 'user-files-2.0.0/ssr-fullstack/overlay');

	beforeEach(async () => {
		project = await makeTempDir();
		await cp(join(FIXTURES, '2.0.0/ssr-fullstack/input'), project, { recursive: true });
		await cp(overlay, project, { recursive: true });
	});
	afterEach(async () => {
		await rm(project, { recursive: true, force: true });
	});

	it('leaves the user files untouched and lists each one that still needs sv migrate', async () => {
		const userFiles = await readTree(overlay);
		const run = await runCodemodFixtureWithWarnings('2.0.0', project);

		expect(run.warnings).toEqual([]);
		for (const file of userFiles.keys()) expect(run.files.has(file), file).toBe(false);

		// What `patch` scans after writing: the patched template files plus the user's own.
		const project_after = new Map([...run.files, ...userFiles]);
		expect(leftovers(project_after)).toEqual([
			'src/lib/features/notes/format.ts',
			'src/lib/hooks/timing.ts',
			'src/routes/(protected)/notes/+page.svelte'
		]);
	});
});

describe('codemod 1.1.4 → 2.0.0 with edited config files', () => {
	let project: string;
	const edit = async (file: string, change: (content: string) => string) => {
		const path = join(project, file);
		await writeFile(path, change(await readFile(path, 'utf-8')));
	};

	beforeEach(async () => {
		project = await makeTempDir();
		await cp(join(FIXTURES, '2.0.0/spa/input'), project, { recursive: true });
	});
	afterEach(async () => {
		await rm(project, { recursive: true, force: true });
	});

	it('keeps an edited svelte.config.js and says how to move it', async () => {
		await edit('svelte.config.js', (c) => c.replace('adapter()', "adapter({ fallback: '200.html' })"));
		const run = await runCodemodFixtureWithWarnings('2.0.0', project);

		expect(run.deleted).toEqual([]);
		expect(run.warnings).toEqual([
			expect.objectContaining({ file: 'svelte.config.js', message: expect.stringContaining('sv migrate sveltekit-3') })
		]);
	});

	it('still passes the adapter to sveltekit() in a vite.config.ts with another plugin list', async () => {
		await edit('vite.config.ts', (c) =>
			c.replace('plugins: [tailwindcss(), sveltekit(), devtoolsJson()]', 'plugins: [tailwindcss(), sveltekit()]')
		);
		const run = await runCodemodFixtureWithWarnings('2.0.0', project);

		expect(run.warnings).toEqual([]);
		const vite = run.files.get('vite.config.ts')!;
		expect(vite).toContain("import adapter from '@sveltejs/adapter-static';");
		expect(vite).toContain('plugins: [tailwindcss(), sveltekit({ preprocess: vitePreprocess(), adapter: adapter() })]');
	});

	it('warns with the snippet when vite.config.ts no longer calls a bare sveltekit()', async () => {
		await edit('vite.config.ts', (c) => c.replace('sveltekit(), devtoolsJson()', 'sveltekit({}), devtoolsJson()'));
		const run = await runCodemodFixtureWithWarnings('2.0.0', project);

		expect(run.warnings).toEqual([
			expect.objectContaining({
				file: 'vite.config.ts',
				message: expect.stringContaining("import adapter from '@sveltejs/adapter-static'")
			})
		]);
	});

	it('upgrades a package.json the user added dependencies to, and leaves other formatting alone', async () => {
		await edit('package.json', (c) => {
			const pkg = JSON.parse(c);
			pkg.dependencies.dayjs = '^1.11.0';
			return JSON.stringify(pkg, null, '\t') + '\n';
		});
		const pkg = JSON.parse((await runCodemodFixtureWithWarnings('2.0.0', project)).files.get('package.json')!);
		expect(pkg.dependencies.dayjs).toBe('^1.11.0');
		expect(pkg.devDependencies['@sveltejs/kit']).toBe('^3.1.0');
		expect(pkg.imports).toEqual({ '#lib': './src/lib/index.js', '#lib/*': './src/lib/*' });

		await edit('package.json', (c) => JSON.stringify(JSON.parse(c), null, 2) + '\n');
		const run = await runCodemodFixtureWithWarnings('2.0.0', project);
		expect(run.warnings).toEqual([
			expect.objectContaining({ file: 'package.json', message: expect.stringContaining('sv migrate sveltekit-3') })
		]);
	});
});
