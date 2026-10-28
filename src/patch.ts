import * as p from '@clack/prompts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { getApplicableCodemods } from './codemods/index.js';
import { applyCodemods, type ProjectConfig } from './codemods/apply.js';

type SsrMode = NonNullable<ProjectConfig['ssrMode']>;
const SSR_MODES: readonly SsrMode[] = ['fullstack', 'fastapi'];

function fail(message: string): never {
	p.log.error(message, { output: process.stderr });
	process.exit(1);
}

function parsePatchFlags(args: string[]): { mode?: SsrMode } {
	let values;
	try {
		({ values } = parseArgs({ args, options: { mode: { type: 'string' } }, strict: true }));
	} catch (err) {
		fail(`${(err as Error).message}\nUsage: create-sveltekitten patch [--mode fullstack|fastapi]`);
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
				value: 'fastapi',
				label: 'FastAPI Backend (BFF Proxy)',
				hint: 'logs in through FastAPI (access_token / refresh_token cookies)'
			}
		]
	});
	if (p.isCancel(mode)) {
		p.cancel('Patch cancelled.');
		process.exit(0);
	}
	return mode;
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
		for (const { file, content, isNew } of pending) {
			const dest = join(process.cwd(), file);
			if (isNew) await mkdir(dirname(dest), { recursive: true });
			await writeFile(dest, content);
		}
		spinner.stop('Changes applied.');
	}

	// Always update version after running applicable codemods
	const updated: ProjectConfig = { ...config, version: latestVersion };
	await writeFile(configPath, JSON.stringify(updated, null, '\t') + '\n');

	p.outro(`Patched to ${latestVersion}. Commit .sveltekitten.json and changed files.`);
}
