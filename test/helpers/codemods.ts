import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
// The built output: the code `patch` users run.
import { codemods, getApplicableCodemods, type Codemod } from '../../dist/codemods/index.js';
import { applyCodemods, type CodemodRun, type ProjectConfig } from '../../dist/codemods/apply.js';

export async function readProjectConfig(fixtureDir: string): Promise<ProjectConfig> {
	return JSON.parse(await readFile(join(fixtureDir, '.sveltekitten.json'), 'utf-8'));
}

/** Runs `list` over the project in `fixtureDir` with the same engine `patch` uses. Never writes. */
export async function runCodemods(list: Codemod[], fixtureDir: string): Promise<CodemodRun> {
	const config = await readProjectConfig(fixtureDir);
	return applyCodemods(list, config, async (file) => {
		try {
			return await readFile(join(fixtureDir, file), 'utf-8');
		} catch {
			return undefined;
		}
	});
}

export function codemodTo(version: string): Codemod {
	const codemod = codemods.find((c) => c.to === version);
	if (!codemod) throw new Error(`No codemod with to === ${version}`);
	return codemod;
}

/** The codemod whose `to` is `version`, run over `fixtureDir`; full result incl. warnings. */
export function runCodemodFixtureWithWarnings(version: string, fixtureDir: string): Promise<CodemodRun> {
	return runCodemods([codemodTo(version)], fixtureDir);
}

/** Final content of every file the codemod whose `to` is `version` touched in `fixtureDir`. */
export async function runCodemodFixture(version: string, fixtureDir: string): Promise<Map<string, string>> {
	return (await runCodemodFixtureWithWarnings(version, fixtureDir)).files;
}

/** Every codemod `patch` would chain for `from` → `to`, run over `fixtureDir`. */
export function runCodemodChain(from: string, to: string, fixtureDir: string): Promise<CodemodRun> {
	return runCodemods(getApplicableCodemods(from, to), fixtureDir);
}

export { codemods };
