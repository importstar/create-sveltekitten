import * as p from '@clack/prompts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getApplicableCodemods } from './codemods/index.js';
import { applyCodemods, type ProjectConfig } from './codemods/apply.js';

export async function patch(latestVersion: string) {
	const configPath = join(process.cwd(), '.sveltekitten.json');

	if (!existsSync(configPath)) {
		p.log.error(
			'No .sveltekitten.json found. This command must be run inside a project created by create-sveltekitten.'
		);
		process.exit(1);
	}

	const config: ProjectConfig = JSON.parse(await readFile(configPath, 'utf-8'));
	const { version: currentVersion, template } = config;

	p.intro(`create-sveltekitten patch`);
	p.log.info(`Project: ${template} @ ${currentVersion} → ${latestVersion}`);

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

// AC4 probe: src changed without rebuilding dist
