import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runGroup } from './proc.mjs';

export async function scaffoldProject(repoRoot, parent, name, template) {
	await mkdir(parent, { recursive: true });
	const args = [join(repoRoot, 'dist/index.js'), '--yes', '--name', name, '--template', template === 'spa' ? 'spa' : 'ssr'];
	if (template === 'ssr-fullstack') args.push('--mode', 'fullstack');
	if (template === 'ssr-fastapi') args.push('--mode', 'fastapi', '--backend-url', 'http://mock:9000');
	const result = await runGroup(process.execPath, args, { cwd: parent, timeoutMs: 120_000 });
	const dir = join(parent, name);
	if (result.code !== 0) return { ...result, dir };
	await writeFile(
		join(dir, '.dockerignore'),
		['node_modules', '.bench-store', '.bench-bun-cache', 'sqlite.db', '.git'].join('\n') + '\n'
	);
	return { ...result, dir };
}
