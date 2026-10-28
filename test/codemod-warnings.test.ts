import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	createFile,
	EDITED_FILE_WARNING,
	EXISTING_FILE_WARNING,
	PATTERN_NOT_FOUND_WARNING,
	replaceFile,
	replaceText
} from '../dist/codemods/helpers.js';
import { makeTempDir, runCli } from './helpers/cli.js';
import { runCodemodFixtureWithWarnings } from './helpers/codemods.js';

const FASTAPI_0_3_22 = fileURLToPath(
	new URL('./fixtures/codemods/0.3.23/ssr-fastapi/input/', import.meta.url)
);
const PROXY = 'src/routes/api/proxy/[...slug]/+server.ts';

describe('transform helpers', () => {
	it('replaceFile swaps the from template, keeps the to template, warns on anything else', () => {
		const transform = replaceFile('old\n', 'new\n');
		expect(transform('old\n')).toBe('new\n');
		expect(transform('old\r\n')).toBe('new\n');
		expect(transform('new\n')).toBe('new\n');
		expect(transform('old\nedited\n')).toEqual({ content: 'old\nedited\n', warnings: [EDITED_FILE_WARNING] });
	});

	it('createFile fills an empty file and warns about a different existing one', () => {
		const transform = createFile('new\n');
		expect(transform('')).toBe('new\n');
		expect(transform('new\r\n')).toBe('new\r\n');
		expect(transform('mine\n')).toEqual({ content: 'mine\n', warnings: [EXISTING_FILE_WARNING] });
	});

	it('replaceText replaces once, is idempotent, and warns when the pattern is gone', () => {
		const transform = replaceText('a: 1', 'a: 2');
		expect(transform('x\na: 1\n')).toBe('x\na: 2\n');
		expect(transform('x\na: 2\n')).toBe('x\na: 2\n');
		expect(transform('x\nb: 1\n')).toEqual({ content: 'x\nb: 1\n', warnings: [PATTERN_NOT_FOUND_WARNING] });
	});
});

describe('an edited file the codemod cannot patch', () => {
	let project: string;
	beforeEach(async () => {
		project = await makeTempDir();
		await cp(FASTAPI_0_3_22, project, { recursive: true });
		const proxy = join(project, PROXY);
		await writeFile(proxy, (await readFile(proxy, 'utf-8')) + '// local edit\n');
	});
	afterEach(async () => {
		await rm(project, { recursive: true, force: true });
	});

	it('is left as is and reported with its file and codemod version', async () => {
		const run = await runCodemodFixtureWithWarnings('0.3.23', project);

		expect(run.warnings).toEqual([
			{ file: PROXY, from: '0.3.22', to: '0.3.23', message: EDITED_FILE_WARNING }
		]);
		expect(run.files.get(PROXY)).toBe(await readFile(join(project, PROXY), 'utf-8'));
		expect(run.changes.map((c) => c.file)).not.toContain(PROXY);
	});

	it('is printed by `patch`', () => {
		// stdin is closed, so patch stops at its confirm prompt after the preview.
		const result = runCli(project, ['patch']);

		expect(result.output).toContain(
			`warning ${PROXY} (codemod 0.3.22 → 0.3.23): ${EDITED_FILE_WARNING}`
		);
	});
});
