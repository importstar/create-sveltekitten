import * as p from '@clack/prompts';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { linkClaudeMd } from './claude-md.js';
import { getApplicableCodemods } from './codemods/index.js';
import type { Codemod } from './codemods/index.js';
import { applyCodemods, findLeftovers, isSourceFile, type ProjectConfig } from './codemods/apply.js';

const SSR_MODES = ['fullstack', 'openapi'] as const;
type SsrMode = (typeof SSR_MODES)[number];
const PATCH_USAGE = 'Usage: create-sveltekitten patch [--mode fullstack|openapi]';

function fail(message: string): never {
	p.log.error(message, { output: process.stderr });
	process.exit(1);
}

function parsePatchFlags(args: string[]): { mode?: SsrMode } {
	let values;
	try {
		({ values } = parseArgs({ args, options: { mode: { type: 'string' } }, strict: true }));
	} catch (err) {
		fail(`${(err as Error).message}\n${PATCH_USAGE}`);
	}
	if (values.mode === 'fastapi') {
		fail(`The SSR mode "fastapi" was renamed to "openapi".\n${PATCH_USAGE}`);
	}
	if (values.mode !== undefined && !(SSR_MODES as readonly string[]).includes(values.mode)) {
		fail(`Invalid --mode "${values.mode}". Allowed: ${SSR_MODES.join(', ')}.`);
	}
	return { mode: values.mode as SsrMode | undefined };
}

/**
 * SSR projects from before ssrMode was recorded don't say which mode they are, and codemods
 * that target one mode would skip them. Ask once (or take --mode) and save the answer.
 */
async function resolveSsrMode(flagMode: SsrMode | undefined): Promise<SsrMode> {
	if (flagMode) return flagMode;
	const mode = await p.select<SsrMode>({
		message: 'This SSR project does not record its mode in .sveltekitten.json. Which one is it?',
		options: [
			{
				value: 'fullstack',
				label: 'SvelteKit Full-Stack',
				hint: 'logs in against the local SQLite database (session_id cookie)'
			},
			{
				value: 'openapi',
				label: 'OpenAPI Backend (BFF Proxy)',
				hint: 'logs in through the API (POST /v1/auth/login, access_token / refresh_token cookies)'
			}
		]
	});
	if (p.isCancel(mode)) {
		p.cancel('Patch cancelled.');
		process.exit(0);
	}
	return mode;
}

// Where `leftovers` are looked for: the project's own source (plus root config files), not
// dependencies or build output.
const SOURCE_DIRS = ['src', 'e2e', 'scripts', 'test', 'tests'];

async function readSourceFiles(root: string): Promise<Map<string, string>> {
	const files = new Map<string, string>();
	// Config files at the root, e.g. eslint.config.js importing svelte.config.js.
	for (const entry of await readdir(root, { withFileTypes: true })) {
		if (entry.isFile() && isSourceFile(entry.name)) {
			files.set(entry.name, await readFile(join(root, entry.name), 'utf-8'));
		}
	}
	for (const dir of SOURCE_DIRS) {
		const base = join(root, dir);
		if (!existsSync(base)) continue;
		for (const entry of await readdir(base, { recursive: true, withFileTypes: true })) {
			if (!entry.isFile() || !isSourceFile(entry.name)) continue;
			const full = join(entry.parentPath, entry.name);
			files.set(relative(root, full).replaceAll('\\', '/'), await readFile(full, 'utf-8'));
		}
	}
	return files;
}

/** Prints each applied codemod's notes, and the source files it could not migrate. */
async function printFollowUps(applied: Codemod[]) {
	const withLeftovers = applied.filter((c) => c.leftovers);
	const sources = withLeftovers.length > 0 ? await readSourceFiles(process.cwd()) : new Map<string, string>();
	for (const codemod of applied) {
		if (codemod.leftovers) {
			const files = findLeftovers(sources, codemod.leftovers.pattern);
			if (files.length > 0) {
				p.log.warn(
					[`${codemod.from} → ${codemod.to}: ${codemod.leftovers.message}`, ...files.map((f) => `  ${f}`)].join('\n')
				);
			}
		}
		if (codemod.notes?.length) p.note(codemod.notes.join('\n'), `Next steps (${codemod.from} → ${codemod.to})`);
	}
}

export async function patch(latestVersion: string, args: string[] = []) {
	const flags = parsePatchFlags(args);
	const configPath = join(process.cwd(), '.sveltekitten.json');

	if (!existsSync(configPath)) {
		p.log.error(
			'No .sveltekitten.json found. This command must be run inside a project created by create-sveltekitten.'
		);
		process.exit(1);
	}

	let config: ProjectConfig = JSON.parse(await readFile(configPath, 'utf-8'));
	const { version: currentVersion, template } = config;

	p.intro(`create-sveltekitten patch`);

	if (config.ssrMode === 'fastapi') {
		fail(
			'This project\'s .sveltekitten.json has ssrMode "fastapi". That mode was renamed to "openapi". Set ssrMode to "openapi" and run patch again.'
		);
	}
	if (flags.mode && template !== 'ssr') fail('--mode only applies to SSR projects.');
	if (flags.mode && config.ssrMode && flags.mode !== config.ssrMode) {
		fail(`This project's .sveltekitten.json already says ssrMode "${config.ssrMode}".`);
	}
	if (template === 'ssr' && !config.ssrMode) {
		config = { ...config, ssrMode: await resolveSsrMode(flags.mode) };
		await writeFile(configPath, JSON.stringify(config, null, '\t') + '\n');
		p.log.info(`Saved ssrMode "${config.ssrMode}" to .sveltekitten.json.`);
	}

	p.log.info(
		`Project: ${template}${config.ssrMode ? ` (${config.ssrMode})` : ''} @ ${currentVersion} → ${latestVersion}`
	);

	if (currentVersion === latestVersion) {
		p.outro('Already up to date.');
		return;
	}

	const applicable = getApplicableCodemods(currentVersion, latestVersion);

	if (applicable.length === 0) {
		p.log.warn(
			`No codemods found for ${currentVersion} → ${latestVersion}. Update .sveltekitten.json manually if needed.`
		);
		p.outro('Done.');
		return;
	}

	// Preview changes. applyCodemods carries each file's content across the chained
	// codemods of this run and never writes; this function prints and writes.
	const run = await applyCodemods(applicable, config, async (file) => {
		const filePath = join(process.cwd(), file);
		return existsSync(filePath) ? readFile(filePath, 'utf-8') : undefined;
	});

	for (const { codemod, transforms } of run.log) {
		p.log.step(`Codemod ${codemod.from} → ${codemod.to}`);
		for (const { file, status, warnings } of transforms) {
			if (status === 'skipped') p.log.warn(`  skip ${file} (not found)`);
			else p.log.info(`  ${status} ${file}`);
			for (const warning of warnings) {
				p.log.warn(`  warning ${file} (codemod ${codemod.from} → ${codemod.to}): ${warning}`);
			}
		}
	}

	const pending = run.changes;

	if (pending.length === 0) {
		p.log.info('No file changes needed.');
	} else {
		const confirm = await p.confirm({
			message: `Apply ${pending.length} file change(s) and update version to ${latestVersion}?`,
			initialValue: true
		});
		if (!confirm || p.isCancel(confirm)) {
			p.cancel('Patch cancelled.');
			return;
		}

		const spinner = p.spinner();
		spinner.start('Applying changes...');
		for (const { file, content, isNew, delete: remove } of pending) {
			const dest = join(process.cwd(), file);
			if (remove) {
				await rm(dest, { force: true });
				continue;
			}
			if (isNew) await mkdir(dirname(dest), { recursive: true });
			await writeFile(dest, content);
		}
		spinner.stop('Changes applied.');
	}

	// Always update version after running applicable codemods
	const updated: ProjectConfig = { ...config, version: latestVersion };
	await writeFile(configPath, JSON.stringify(updated, null, '\t') + '\n');

	if (await linkClaudeMd(process.cwd())) p.log.info('Linked CLAUDE.md → AGENTS.md.');

	await printFollowUps(applicable);

	p.outro(`Patched to ${latestVersion}. Commit .sveltekitten.json and changed files.`);
}
