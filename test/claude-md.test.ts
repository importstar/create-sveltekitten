import { lstat, mkdir, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { linkClaudeMd } from '../dist/claude-md.js';
import { makeTempDir } from './helpers/cli.js';

describe('linkClaudeMd', () => {
	let dir: string;
	beforeEach(async () => {
		dir = await makeTempDir();
	});
	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it('points CLAUDE.md at AGENTS.md when CLAUDE.md is absent', async () => {
		await writeFile(join(dir, 'AGENTS.md'), '# instructions\n');

		expect(await linkClaudeMd(dir)).toBe(true);
		expect((await lstat(join(dir, 'CLAUDE.md'))).isSymbolicLink()).toBe(true);
		expect(await readlink(join(dir, 'CLAUDE.md'))).toBe('AGENTS.md');
	});

	it('leaves a CLAUDE.md the project already has', async () => {
		await writeFile(join(dir, 'AGENTS.md'), '# instructions\n');
		await writeFile(join(dir, 'CLAUDE.md'), '# mine\n');

		expect(await linkClaudeMd(dir)).toBe(false);
		expect((await lstat(join(dir, 'CLAUDE.md'))).isSymbolicLink()).toBe(false);
	});

	it('leaves an existing symlink', async () => {
		await writeFile(join(dir, 'AGENTS.md'), '# instructions\n');
		await symlink('AGENTS.md', join(dir, 'CLAUDE.md'));

		expect(await linkClaudeMd(dir)).toBe(false);
		expect(await readlink(join(dir, 'CLAUDE.md'))).toBe('AGENTS.md');
	});

	it('does nothing when the project has no AGENTS.md', async () => {
		await mkdir(join(dir, 'src'));

		expect(await linkClaudeMd(dir)).toBe(false);
		await expect(lstat(join(dir, 'CLAUDE.md'))).rejects.toMatchObject({ code: 'ENOENT' });
	});
});
