#!/usr/bin/env node
import * as p from '@clack/prompts';
import { cp, mkdir, readFile, writeFile, readdir, rename, unlink } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs, styleText } from 'node:util';
import { linkClaudeMd } from './claude-md.js';
import { patch } from './patch.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '../templates');

// @clack/prompts 1.x no longer dims note() body text by default; this restores the 0.x look.
const dimNote = { format: (line: string) => styleText('dim', line) };

async function getVersion(): Promise<string> {
	const pkg = JSON.parse(await readFile(join(__dirname, '../package.json'), 'utf-8'));
	return pkg.version;
}

async function replaceInFile(filePath: string, replacements: Record<string, string>) {
	let content = await readFile(filePath, 'utf-8');
	for (const [from, to] of Object.entries(replacements)) {
		content = content.replaceAll(from, to);
	}
	await writeFile(filePath, content);
}

async function walkDir(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		if (entry.name === 'node_modules') continue;
		const fullPath = join(dir, entry.name);
		// A symlink (CLAUDE.md → AGENTS.md) must stay a link. writeFile would replace it with a regular file.
		if (entry.isSymbolicLink()) continue;
		if (entry.isDirectory()) {
			files.push(...(await walkDir(fullPath)));
		} else {
			files.push(fullPath);
		}
	}
	return files;
}

/** npm omits `.gitignore` from packages; templates ship `_gitignore` instead. */
async function materializeGitignore(targetDir: string) {
	const underscore = join(targetDir, '_gitignore');
	const dot = join(targetDir, '.gitignore');
	if (!existsSync(underscore)) return;
	if (existsSync(dot)) {
		await unlink(underscore);
	} else {
		await rename(underscore, dot);
	}
}

// OpenAPI specs are fetched from the backend verbatim; a `{{...}}` inside one is the API's data.
const NO_REPLACEMENT_DIRS = ['src/libs/api-specs/'];

async function applyReplacements(targetDir: string, replacements: Record<string, string>) {
	const textExts = new Set([
		'.ts', '.svelte', '.js', '.json', '.css', '.html', '.md', '.env',
		'.prettierrc', '.gitignore', '.eslintrc', '.d.ts', '.lock'
	]);
	const files = await walkDir(targetDir);
	for (const file of files) {
		const rel = relative(targetDir, file).split(sep).join('/');
		if (NO_REPLACEMENT_DIRS.some((dir) => rel.startsWith(dir))) continue;
		const basename = file.split('/').pop() ?? '';
		const isText = textExts.has('.' + (file.split('.').pop() ?? '')) ||
			basename.startsWith('.') ||
			!file.includes('.');
		if (isText) {
			try {
				await replaceInFile(file, replacements);
			} catch {
				// skip binary files
			}
		}
	}
}

const TEMPLATES = ['ssr', 'spa'] as const;
const SSR_MODES = ['fullstack', 'openapi'] as const;
const PACKAGE_MANAGERS = ['bun', 'pnpm'] as const;
const SCAFFOLD_USAGE =
	'Usage: create-sveltekitten [--name <name>] [--template ssr|spa] [--mode fullstack|openapi] [--pm bun|pnpm] [--backend-url <url>] [--yes]';
type Template = (typeof TEMPLATES)[number];
type SsrMode = (typeof SSR_MODES)[number];
type PackageManager = (typeof PACKAGE_MANAGERS)[number];
const DEFAULT_BACKEND_URL = 'http://localhost:9000';

interface ScaffoldFlags {
	name?: string;
	template?: Template;
	mode?: SsrMode;
	pm?: PackageManager;
	backendUrl?: string;
	yes: boolean;
}

function fail(message: string): never {
	p.log.error(message, { output: process.stderr });
	process.exit(1);
}

function oneOf<T extends string>(flag: string, value: string | undefined, allowed: readonly T[]): T | undefined {
	if (value === undefined) return undefined;
	if (!(allowed as readonly string[]).includes(value)) {
		fail(`Invalid ${flag} "${value}". Allowed: ${allowed.join(', ')}.`);
	}
	return value as T;
}

/** Flags for a non-interactive scaffold; anything missing is prompted for, unless --yes. */
function parseFlags(args: string[]): ScaffoldFlags {
	let values;
	try {
		({ values } = parseArgs({
			args,
			options: {
				name: { type: 'string' },
				template: { type: 'string' },
				mode: { type: 'string' },
				pm: { type: 'string' },
				'backend-url': { type: 'string' },
				yes: { type: 'boolean' }
			},
			strict: true,
			allowPositionals: false
		}));
	} catch (err) {
		fail(`${(err as Error).message}\n${SCAFFOLD_USAGE}`);
	}
	if (values.mode === 'fastapi') {
		fail(`The SSR mode "fastapi" was renamed to "openapi".\n${SCAFFOLD_USAGE}`);
	}

	const name = values.name?.trim();
	if (values.name !== undefined && !name) fail('--name must not be empty.');
	const template = oneOf('--template', values.template, TEMPLATES);
	const mode = oneOf('--mode', values.mode, SSR_MODES);
	const pm = oneOf('--pm', values.pm, PACKAGE_MANAGERS);
	if (mode && template === 'spa') fail('--mode only applies to --template ssr.');
	const yes = values.yes ?? false;

	if (yes) {
		if (!name) fail('--yes needs --name.');
		if (!template) fail(`--yes needs --template (${TEMPLATES.join(' or ')}).`);
		if (template === 'ssr' && !mode) fail(`--yes with --template ssr needs --mode (${SSR_MODES.join(' or ')}).`);
	}

	return { name, template, mode, pm, backendUrl: values['backend-url'], yes };
}

/** `bun/1.2.0` and `pnpm/10.0.0 ...` come from npm_config_user_agent. Anything else is unknown. */
function packageManagerFromUserAgent(userAgent = process.env.npm_config_user_agent): PackageManager | undefined {
	const name = userAgent?.split('/')[0];
	if (name === 'bun' || name === 'pnpm') return name;
	return undefined;
}

async function resolvePackageManager(flag: PackageManager | undefined, yes: boolean): Promise<PackageManager> {
	if (flag) return flag;
	const detected = packageManagerFromUserAgent();
	if (detected) return detected;
	if (yes) return 'bun';
	const answer = await p.select<PackageManager>({
		message: 'Package manager',
		initialValue: 'bun',
		options: [
			{ value: 'bun', label: 'bun', hint: 'default' },
			{ value: 'pnpm', label: 'pnpm' }
		]
	});
	if (p.isCancel(answer)) {
		p.cancel('Cancelled.');
		process.exit(0);
	}
	return answer;
}

function packageManagerSpec(pm: PackageManager, targetDir: string): string {
	if (pm === 'pnpm') {
		try {
			const lock = readFileSync(join(targetDir, 'pnpm-lock.yaml'), 'utf8');
			const specifier = lock.match(/packageManagerDependencies:\n {2}pnpm:\n {4}specifier: ([^\n]+)/);
			if (specifier) return `pnpm@${specifier[1].trim()}`;
		} catch {
			// No pnpm lockfile in this project.
		}
	}
	try {
		const version = execFileSync(pm, ['--version'], { encoding: 'utf8' }).trim();
		if (version) return `${pm}@${version}`;
	} catch {
		// The binary is not on PATH; record the name without a version.
	}
	return pm;
}

const LOCKFILES: Record<PackageManager, string> = { bun: 'bun.lock', pnpm: 'pnpm-lock.yaml' };

/** Whole word `pnpm`, so `pnpm-lock.yaml` is left alone. */
const PNPM_WORD = /(?<![\w-])pnpm(?![\w-])/g;

function shouldRewritePackageManager(relPath: string): boolean {
	if (relPath.startsWith('src/libs/api-specs/')) return false;
	if (relPath === 'scripts/check.sh') return false;
	const base = relPath.split('/').pop() ?? '';
	return base !== 'pnpm-lock.yaml' && base !== 'bun.lock' && base !== 'pnpm-workspace.yaml';
}

/** Template text stays pnpm-canonical. A bun scaffold rewrites that word in place. */
async function rewritePnpmCommands(targetDir: string) {
	for (const file of await walkDir(targetDir)) {
		const rel = relative(targetDir, file).split(sep).join('/');
		if (!shouldRewritePackageManager(rel)) continue;
		const basename = file.split('/').pop() ?? '';
		const isText =
			['.ts', '.svelte', '.js', '.json', '.css', '.html', '.md', '.sh'].includes(
				'.' + (file.split('.').pop() ?? '')
			) ||
			basename.startsWith('.') ||
			!file.includes('.');
		if (!isText) continue;
		const content = await readFile(file, 'utf-8');
		const next = content.replace(PNPM_WORD, 'bun');
		if (next !== content) await writeFile(file, next);
	}
}

async function recordPackageManager(targetDir: string, pm: PackageManager) {
	const pkgPath = join(targetDir, 'package.json');
	const pkg = JSON.parse(await readFile(pkgPath, 'utf-8')) as Record<string, unknown>;
	pkg.packageManager = packageManagerSpec(pm, targetDir);
	await writeFile(pkgPath, JSON.stringify(pkg, null, '\t') + '\n');
}

async function main(flags: ScaffoldFlags) {
	const version = await getVersion();
	p.intro(`create-sveltekitten v${version}`);

	let projectName = flags.name;
	if (projectName === undefined) {
		const answer = await p.text({
			message: 'Project name',
			placeholder: 'my-app',
			validate: (v) => (v?.trim() ? undefined : 'Required')
		});
		if (p.isCancel(answer)) {
			p.cancel('Cancelled.');
			process.exit(0);
		}
		projectName = answer;
	}

	let template = flags.template;
	if (template === undefined) {
		const answer = await p.select<Template>({
			message: 'Template',
			options: [
				{
					value: 'ssr',
					label: 'SSR',
					hint: `v${version} · adapter-node · full-stack (Drizzle SQLite) or OpenAPI BFF`
				},
				{
					value: 'spa',
					label: 'SPA',
					hint: `v${version} · adapter-static · client-side auth · TanStack Query`
				}
			]
		});
		if (p.isCancel(answer)) {
			p.cancel('Cancelled.');
			process.exit(0);
		}
		template = answer;
	}
	if (flags.mode && template === 'spa') fail('--mode only applies to --template ssr.');

	const packageManager = await resolvePackageManager(flags.pm, flags.yes);

	let ssrMode: SsrMode | undefined;
	let backendUrl = flags.backendUrl ?? DEFAULT_BACKEND_URL;

	if (template === 'ssr') {
		ssrMode = flags.mode;
		if (ssrMode === undefined) {
			const mode = await p.select<SsrMode>({
				message: 'Backend architecture for SSR',
				options: [
					{
						value: 'fullstack',
						label: 'SvelteKit Full-Stack (Integrated)',
						hint: 'SQLite · Drizzle ORM · Server Actions · Local Database'
					},
					{
						value: 'openapi',
						label: 'OpenAPI Backend (BFF Proxy)',
						hint: 'OpenAPI client · /api/proxy/** · external API'
					}
				]
			});
			if (p.isCancel(mode)) {
				p.cancel('Cancelled.');
				process.exit(0);
			}
			ssrMode = mode;
		}

		if (ssrMode === 'openapi' && flags.backendUrl === undefined && !flags.yes) {
			const url = await p.text({
				message: 'BACKEND_API_URL (API base URL)',
				placeholder: DEFAULT_BACKEND_URL,
				initialValue: DEFAULT_BACKEND_URL
			});
			if (p.isCancel(url)) {
				p.cancel('Cancelled.');
				process.exit(0);
			}
			backendUrl = url;
		}
	} else if (flags.backendUrl === undefined && !flags.yes) {
		const url = await p.text({
			message: 'PUBLIC_API_URL (backend base URL)',
			placeholder: DEFAULT_BACKEND_URL,
			initialValue: DEFAULT_BACKEND_URL
		});
		if (p.isCancel(url)) {
			p.cancel('Cancelled.');
			process.exit(0);
		}
		backendUrl = url;
	}

	const targetDir = join(process.cwd(), projectName as string);

	if (existsSync(targetDir)) {
		if (flags.yes) fail(`Directory "${projectName}" already exists. --yes never overwrites; choose another --name.`);
		const overwrite = await p.confirm({
			message: `Directory "${projectName}" already exists. Overwrite?`,
			initialValue: false
		});
		if (!overwrite || p.isCancel(overwrite)) {
			p.cancel('Cancelled.');
			process.exit(0);
		}
	}

	const spinner = p.spinner();
	spinner.start('Scaffolding project...');

	try {
		await mkdir(targetDir, { recursive: true });

		// SSR is the shared templates/ssr plus the chosen mode's overlay, templates/ssr-<mode>,
		// which adds that mode's code, package.json and lockfile.
		// verbatimSymlinks keeps CLAUDE.md → AGENTS.md relative. The default rewrites it to an absolute path in this package.
		const copy = { recursive: true, force: true, verbatimSymlinks: true } as const;
		const templateDir = join(TEMPLATES_DIR, template as string);
		await cp(templateDir, targetDir, copy);
		if (template === 'ssr') {
			await cp(join(TEMPLATES_DIR, `ssr-${ssrMode}`), targetDir, copy);
		}
		await materializeGitignore(targetDir);

		const replacements: Record<string, string> = {
			'{{PROJECT_NAME}}': projectName as string,
			'{{BACKEND_URL}}': backendUrl as string
		};

		await applyReplacements(targetDir, replacements);
		if (packageManager === 'bun') await rewritePnpmCommands(targetDir);
		await unlink(join(targetDir, packageManager === 'bun' ? 'pnpm-lock.yaml' : 'bun.lock')).catch(() => undefined);
		await recordPackageManager(targetDir, packageManager);
		await linkClaudeMd(targetDir);

		const envLines =
			template === 'spa'
				? `PUBLIC_APP_TITLE=${projectName}\nPUBLIC_API_URL=${backendUrl}\n`
				: ssrMode === 'fullstack'
					? `PUBLIC_APP_TITLE=${projectName}\nDATABASE_URL=sqlite.db\n`
					: `PUBLIC_APP_TITLE=${projectName}\nBACKEND_API_URL=${backendUrl}\n`;

		await writeFile(join(targetDir, '.env'), envLines);

		await writeFile(
			join(targetDir, '.sveltekitten.json'),
			JSON.stringify(
				{
					version: await getVersion(),
					template,
					...(ssrMode ? { ssrMode } : {}),
					packageManager
				},
				null,
				'\t'
			) + '\n'
		);

		spinner.stop('Project scaffolded!');
	} catch (err) {
		spinner.stop('Failed.');
		p.log.error(String(err));
		process.exit(1);
	}

	const pm = packageManager;
	if (template === 'ssr' && ssrMode === 'fullstack') {
		p.note(
			[
				`cd ${projectName}`,
				`${pm} install`,
				`${pm} user:create admin`,
				`${pm} dev`
			].join('\n'),
			'Next steps',
			dimNote
		);

		p.note(
			[
				'Manage database schema & data:',
				`  ${pm} db:push    # push schema changes to sqlite.db`,
				`  ${pm} db:studio  # open Drizzle Studio in browser`,
				`  ${pm} db:generate # generate SQL migrations`
			].join('\n'),
			'Database',
			dimNote
		);
	} else {
		p.note(
			[`cd ${projectName}`, `${pm} install`, `${pm} dev`].join('\n'),
			'Next steps',
			dimNote
		);
	}

	if (template === 'ssr' && ssrMode === 'openapi') {
		p.note(
			[
				'Fetch latest spec and regenerate types:',
				`  ${pm} openapi:update`,
				'',
				'Or regenerate from committed spec only:',
				`  ${pm} openapi:generate`
			].join('\n'),
			'API types',
			dimNote
		);
	}

	p.outro('Happy coding!');
}

const command = process.argv[2];

if (command === 'patch') {
	getVersion()
		.then((v) => patch(v, process.argv.slice(3)))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
} else {
	main(parseFlags(process.argv.slice(2))).catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
