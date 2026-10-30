import { existsSync } from 'node:fs';
import { lstat, symlink } from 'node:fs/promises';
import { join } from 'node:path';

const AGENTS = 'AGENTS.md';
const CLAUDE = 'CLAUDE.md';

/**
 * When the project has `AGENTS.md` and no `CLAUDE.md`, point `CLAUDE.md` at it.
 * A `CLAUDE.md` that already exists (a file or a symlink) is left alone.
 * Returns true when the link was created.
 */
export async function linkClaudeMd(projectDir: string): Promise<boolean> {
	if (!existsSync(join(projectDir, AGENTS))) return false;
	const claude = join(projectDir, CLAUDE);
	try {
		await lstat(claude);
		return false;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
	}
	await symlink(AGENTS, claude);
	return true;
}
