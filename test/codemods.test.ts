import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { codemods, runCodemodChain, runCodemodFixtureWithWarnings } from './helpers/codemods.js';

const FIXTURES = fileURLToPath(new URL('./fixtures/codemods/', import.meta.url));
const FIRST_TESTED = [0, 3, 0];

function listFiles(dir: string): string[] {
	return readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => relative(dir, join(entry.parentPath, entry.name)));
}

const isTested = (version: string) => {
	const v = version.split('.').map(Number);
	for (let i = 0; i < 3; i++) if (v[i] !== FIRST_TESTED[i]) return v[i] > FIRST_TESTED[i];
	return true;
};

const variantsOf = (dir: string) => (existsSync(dir) ? readdirSync(dir).sort() : []);

async function expectSnapshot(files: Map<string, string>, variantDir: string) {
	const expectedDir = join(variantDir, 'expected');
	const hadExpected = existsSync(expectedDir);
	for (const [file, content] of files) {
		await expect(content, file).toMatchFileSnapshot(join(expectedDir, file));
	}
	// A file the codemod no longer touches must not linger in expected/.
	if (hadExpected) expect(listFiles(expectedDir).sort()).toEqual([...files.keys()].sort());
}

describe.each(codemods.filter((c) => isTested(c.to)))('codemod $from → $to', (codemod) => {
	const dir = join(FIXTURES, codemod.to);

	it('has a fixture (node scripts/make-codemod-fixture.mjs <to>)', () => {
		expect(variantsOf(dir)).not.toEqual([]);
	});

	it.each(variantsOf(dir))('%s: output matches expected/', async (variant) => {
		const run = await runCodemodFixtureWithWarnings(codemod.to, join(dir, variant, 'input'));
		expect(run.warnings).toEqual([]);
		expect(run.changes.map((c) => c.file)).not.toEqual([]);
		await expectSnapshot(run.files, join(dir, variant));
	});
});

describe('chained codemods 0.3.0 → 0.3.3', () => {
	const dir = join(FIXTURES, 'chain-0.3.0-0.3.3');

	it.each(variantsOf(dir))('%s: each codemod sees the previous one’s output', async (variant) => {
		const run = await runCodemodChain('0.3.0', '0.3.3', join(dir, variant, 'input'));
		expect(run.log.map((l) => l.codemod.to)).toEqual(['0.3.1', '0.3.2', '0.3.3']);
		expect(run.warnings).toEqual([]);
		await expectSnapshot(run.files, join(dir, variant));
	});
});
