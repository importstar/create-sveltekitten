import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyCodemods } from '../dist/codemods/apply.js';
import type { Codemod } from '../dist/codemods/index.js';
import { makeTempDir, runCli } from './helpers/cli.js';

const FULLSTACK_0_3_24 = fileURLToPath(
	new URL('./fixtures/codemods/1.0.0/ssr-fullstack/input/', import.meta.url)
);
const LOGIN = 'src/routes/login/+page.server.ts';

describe('ssrMode filter (issue #2, AC5)', () => {
	const codemod: Codemod = {
		from: '0.0.0',
		to: '0.0.1',
		transforms: [
			{ file: 'a.ts', template: 'ssr', ssrMode: 'fastapi', transform: () => 'fastapi' },
			{ file: 'b.ts', template: 'ssr', ssrMode: 'fullstack', transform: () => 'fullstack' },
			{ file: 'c.ts', template: 'ssr', transform: () => 'any ssr' }
		]
	};
	const read = async () => 'before';

	it('skips a transform for the other mode', async () => {
		const run = await applyCodemods([codemod], { version: '0.0.0', template: 'ssr', ssrMode: 'fullstack' }, read);
		expect([...run.files]).toEqual([
			['b.ts', 'fullstack'],
			['c.ts', 'any ssr']
		]);
	});

	it('skips every mode-specific transform when the project records no ssrMode', async () => {
		const run = await applyCodemods([codemod], { version: '0.0.0', template: 'ssr' }, read);
		expect([...run.files]).toEqual([['c.ts', 'any ssr']]);
	});

	it('applies a fastapi-tagged transform when the project ssrMode is openapi', async () => {
		const run = await applyCodemods([codemod], { version: '0.0.0', template: 'ssr', ssrMode: 'openapi' }, read);
		expect([...run.files]).toEqual([
			['a.ts', 'fastapi'],
			['c.ts', 'any ssr']
		]);
	});
});

describe('patch in an SSR project without ssrMode', () => {
	let project: string;
	const configPath = () => join(project, '.sveltekitten.json');
	const config = async () => JSON.parse(await readFile(configPath(), 'utf-8'));

	beforeEach(async () => {
		project = await makeTempDir();
		await cp(FULLSTACK_0_3_24, project, { recursive: true });
		await writeFile(configPath(), JSON.stringify({ version: '0.3.24', template: 'ssr' }, null, '\t') + '\n');
	});
	afterEach(async () => {
		await rm(project, { recursive: true, force: true });
	});

	it('asks for the mode and changes nothing when there is no answer', async () => {
		// stdin is closed, so the prompt is cancelled.
		const result = runCli(project, ['patch']);

		expect(result.output).toContain('does not record its mode');
		expect(await config()).toEqual({ version: '0.3.24', template: 'ssr' });
	});

	it('saves --mode and runs that mode’s codemods', async () => {
		// stdin is closed, so patch stops at its confirm prompt after the preview.
		const result = runCli(project, ['patch', '--mode', 'fullstack']);

		expect(result.output).toContain('Saved ssrMode "fullstack"');
		expect(result.output).toContain(`modified ${LOGIN}`);
		expect(await config()).toEqual({ version: '0.3.24', template: 'ssr', ssrMode: 'fullstack' });
	});

	it('rejects --mode that contradicts the recorded one', async () => {
		await writeFile(configPath(), JSON.stringify({ version: '0.3.24', template: 'ssr', ssrMode: 'openapi' }));
		const result = runCli(project, ['patch', '--mode', 'fullstack']);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain('already says ssrMode "openapi"');
	});

	it('refuses a project whose ssrMode is still fastapi', async () => {
		await writeFile(configPath(), JSON.stringify({ version: '0.3.24', template: 'ssr', ssrMode: 'fastapi' }));
		const result = runCli(project, ['patch']);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain('Set ssrMode to "openapi" and run patch again');
		expect(await config()).toEqual({ version: '0.3.24', template: 'ssr', ssrMode: 'fastapi' });
	});

	it('rejects --mode fastapi', async () => {
		const result = runCli(project, ['patch', '--mode', 'fastapi']);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain('renamed to "openapi"');
		expect(await config()).toEqual({ version: '0.3.24', template: 'ssr' });
	});
});
