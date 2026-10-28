import { spawnSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CLI = fileURLToPath(new URL('../../dist/index.js', import.meta.url));

export const makeTempDir = () => mkdtemp(join(tmpdir(), 'sveltekitten-test-'));

/**
 * Runs the built CLI in `cwd` with stdin closed: a prompt cannot be answered, so it either
 * ends the run without scaffolding or hangs until the timeout.
 */
export function runCli(cwd: string, args: string[], timeout = 20_000) {
	const result = spawnSync(process.execPath, [CLI, ...args], {
		cwd,
		encoding: 'utf-8',
		stdio: ['ignore', 'pipe', 'pipe'],
		timeout,
		env: { ...process.env, NO_COLOR: '1', CI: '1' }
	});
	return {
		status: result.status,
		timedOut: result.error !== undefined,
		stdout: result.stdout,
		stderr: result.stderr,
		output: result.stdout + result.stderr
	};
}
